import { BladesSheet } from '../blades-sheet.js';
import { BladesActiveEffect } from '../blades-active-effect.js';
import { BladesHelpers } from '../blades-helpers.js';
import { bladesRoll, buildRollPopup, resolveRollModifierArray, resolveConditionalModifiers,
  checkDowntimeRules, dialogOnFirstRender, dialogOnRender, refreshModifiers, postRollProcessing,
  pruneInvalidConditionalRollModifiers, keepValidModifiersFromOther } from '../blades-roll.js';
import { BeamChatMessage } from '../messages/beam-chat-message.js';

/**
 * @extends {BladesSheet}
 */
export class BladesSquadSheet extends BladesSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['beamsaber', 'sheet', 'actor', 'crew'],
      template: 'systems/beamsaber/templates/actors/crew-sheet.html',
      width: 930,
      height: 800,
      tabs: [{ navSelector: '.tabs', contentSelector: '.tab-content', initial: 'members' }]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    const superData = super.getData(options);
    const sheetData = superData.data;

    sheetData.owner = superData.owner;
    sheetData.editable = superData.editable;
    sheetData.document = superData.document;
    sheetData.isGM = game.user.isGM;

    // Prepare active effects
    sheetData.effects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);

    sheetData.system.members = BladesHelpers.fetchSimpleData(sheetData.system.members, [], BladesHelpers._simpleCompareFunc);
    sheetData.system.faction = BladesHelpers.resolveActor(sheetData.system.faction, { name: 'Unknown Faction' });
    sheetData.system.region = BladesHelpers.resolveActor(sheetData.system.region, { name: 'Unknown Region' });

    // Fetch relationships data and direct relationships
    [sheetData.system.relationships, sheetData.system.direct_relationships] = BladesHelpers.fetchFullAndRelativeRelationshipsData(this.actor, sheetData.system.relationships);

    sheetData.system.crew_reputation = BladesHelpers.getOwnedItem(this.actor, sheetData.system.crew_reputation);
    sheetData.system.type = BladesHelpers.getOwnedItem(this.actor, sheetData.system.type);

    sheetData.defaultClockThemeColor = game.settings.get('beamsaber', 'DefaultClockThemeColor');

    sheetData.system.tier.max = sheetData.system.is_player_crew ? 4 : 5;
    if (sheetData.system.tier.value > sheetData.system.tier.max) {
      sheetData.system.tier.value = sheetData.system.tier.max;
    }

    sheetData.system.heart = this.computeHeart(sheetData);

    sheetData.vendettas = BladesHelpers.fetchAllRelationships(this.actor).filter(r => r.status == -3).map(r => BladesHelpers.resolveActor(r.owner)).filter(r => r != null).map(r => r.name).join(', ');
    if (game.i18n.lang == 'en') sheetData.vendettas = sheetData.vendettas.replace(/,([^,]*)$/, ' and$1');

    for (let cohort of sheetData.items.filter(i => i.type == 'cohort'))
      if (cohort.system.owner)
        cohort.system.owner = BladesHelpers.resolveActor(cohort.system.owner);

    return sheetData;
  }

  /** @override */
  async _onDropItem(event, droppedItem) {
    await super._onDropItem(event, droppedItem);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this squad. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedItem);
  }

  /** @override */
  async _onDropActor(event, droppedActor) {
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this squad. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedActor);
  }

  /** @override */
  async handleDrop(event, droppedEntity) {
    let droppedEntityFull = BladesHelpers.resolveActor(droppedEntity.uuid);
    await this.handleAddedObjects([droppedEntityFull]);
  }

  async handleAddedObjects(droppedEntitiesFull) {
    let currentTab = this._tabs[0].active;
    for (let droppedEntityFull of droppedEntitiesFull) {
      if (!droppedEntityFull || droppedEntityFull.uuid == this.actor.uuid)
        continue;

      switch (droppedEntityFull.type) {
        case 'faction':
          if (currentTab == 'relationships')
            await BladesHelpers.addRelationship(this.actor, droppedEntityFull);
          else
            await BladesHelpers.addFactionSquad(droppedEntityFull, this.actor, false);
          break;
        case 'region':
          await BladesHelpers.addSquadRegion(this.actor, droppedEntityFull, true);
          break;
        case 'crew':
          if (currentTab == 'relationships')
            await BladesHelpers.addRelationship(this.actor, droppedEntityFull);
          break;
        case 'character':
          await BladesHelpers.addSquadCharacter(this.actor, droppedEntityFull, true);
          break;
        case 'npc':
          await BladesHelpers.addSquadNPC(this.actor, droppedEntityFull, true);
          break;
        case 'crew_type':
          await this.addItemAsObjectAndStoreReference(droppedEntityFull, 'system.type');
          break;
        case 'crew_reputation':
          await this.addItemAsObjectAndStoreReference(droppedEntityFull, 'system.crew_reputation');
          break;
        default:
          break;
      }
    }
  }

  computeHeart(sheetData) {
    let heart = sheetData.system.heart;
    let accordCount = 0, fiendsCount = 0;
    if (sheetData.system.accord || sheetData.system.fiends) {
      let relationships = BladesHelpers.fetchAllRelationships(this.actor);
      for (let relationship of relationships) {
        let entityFull = BladesHelpers.resolveActor(relationship.uuid);
        if (entityFull?.type == 'faction') {
          if (sheetData.system.accord && relationship.status == 3) accordCount = Math.min(accordCount + 1, 3);
          if (sheetData.system.fiends && relationship.status == -3) fiendsCount = Math.min(fiendsCount + 1, 3);
        }
      }
    }
    return heart + accordCount + fiendsCount;
  }

  /**
   * Call a popup for creating a group action.
   */
  async createGroupActionPopup() {
    let attributes = '';
    for (let attribute of BladesHelpers.getAllActions())
      attributes += `<option value="${attribute}">${game.i18n.localize(BladesHelpers.getAttributeLabel(attribute))}</option>`
    let members = '';
    for (let member of Object.values(this.actor.system.members)) {
      let memberFull = BladesHelpers.resolveActor(member.uuid);
      if (memberFull && memberFull.type == 'character')
        members += `<option value="${member.uuid}">${memberFull.name}</option>`
    }

    let contents = `
      <h2>${game.i18n.localize('BITD.CreateGroupAction')}</h2>
      <form>
        <div class="form-group">
          <label>${game.i18n.localize('BITD.Action')}:</label>
          <select id="attribute" name="attribute">
            ${attributes}
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('BITD.Position')}:</label>
          <select id="pos" name="pos">
            <option value="controlled">${game.i18n.localize('BITD.PositionControlled')}</option>
            <option value="risky" selected>${game.i18n.localize('BITD.PositionRisky')}</option>
            <option value="desperate">${game.i18n.localize('BITD.PositionDesperate')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('BITD.Effect')}:</label>
          <select id="effect" name="effect">
            <option value="limited">${game.i18n.localize('BITD.EffectLimited')}</option>
            <option value="standard" selected>${game.i18n.localize('BITD.EffectStandard')}</option>
            <option value="great">${game.i18n.localize('BITD.EffectGreat')}</option>
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('BITD.Leader')}:</label>
          <select id="leader" name="leader">
            ${members}
          </select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize('BITD.Notes')}:</label>
          <input id="note" name="note" type="text" value="">
        </div>
      </form>`;

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('BITD.CreateGroupAction')}` },
      content: contents,
      buttons: [
        {
          icon: 'fas fa-people-group',
          label: game.i18n.localize('BITD.CreateGroupAction'),
          action: 'create-group-action',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'create-group-action') return;

        let html = $(dialog.element);
        let attribute = html.find('[name="attribute"]')[0].value;
        let position = html.find('[name="pos"]')[0].value;
        let effect = html.find('[name="effect"]')[0].value;
        let leaderFull = BladesHelpers.resolveActor(html.find('[name="leader"]')[0].value);
        let note = html.find('[name="note"]')[0].value;
        let speaker = {
          actor: this.actor._id,
          alias: this.actor.name,
          scene: null,
          token: this.actor.prototypeToken._id
        };
        await this.actor.createGroupAction(attribute, position, true, effect, true, leaderFull, note);
        let messageData = {
          speaker: speaker,
          groupActionSquad: this.actor.uuid,
          content: await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/rolls/group-action-begin.html', { attribute_label: BladesHelpers.getAttributeLabel(attribute), position: this.actor.system.group_action.position, effect: this.actor.system.group_action.effect, leader: leaderFull, note: note, isGM: game.user.isGM })
        }
        BeamChatMessage.create(messageData);
      }
    });
    dialog.render(true);
  }

  /**
   * Call a popup for starting a mission.
   */
  async startMissionPopup() {
    let extraData = {};
    extraData.a_little_something_on_the_side = Object.values(this.actor.system.members).map(m => BladesHelpers.resolveActor(m)).filter(m => m != null && m.system.a_little_something_on_the_side).map(m => m.name).join(', ');
    extraData.tier = this.actor.system.tier.value;

    let scarredPilotsWithNoCutLoose = [];
    for (let member of Object.values(this.actor.system.members)) {
      let memberFull = BladesHelpers.resolveActor(member.uuid);
      if (!memberFull || memberFull.type != 'character') continue;
      let scars = Number(memberFull.system.trauma.value);
      if (scars > 0 && !memberFull.system.downtime_activities.cutLoose)
        scarredPilotsWithNoCutLoose.push(memberFull);
    }
    extraData.scarred_pilots = scarredPilotsWithNoCutLoose.map(p => `<option value="${p.uuid}" selected>${p.name}</option>`);
    extraData.scarred_pilots_count = scarredPilotsWithNoCutLoose.length;

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('BITD.StartMission')}` },
      content: await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/popups/start-mission.html', {extraData: extraData}),
      classes: ['start-mission'],
      buttons: [
        {
          icon: 'fas fa-person-walking',
          label: game.i18n.localize('BITD.StartMission'),
          action: 'start-mission',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'start-mission') return;

        let messageContents = '';

        if (dialog.element.querySelector('[name="cutLooseScar"]').checked && dialog.element.querySelector('[name="cutLooseScarPilots"]')) {
          let selectedOptions = dialog.element.querySelector('[name="cutLooseScarPilots"]').selectedOptions;
          let cutLooseScarMessage = '';
          for (let selectedOption of selectedOptions) {
            let memberFull = BladesHelpers.resolveActor(selectedOption.value);
            let scars = Number(memberFull.system.trauma.value);
            let resultStress = Math.max(Math.min(Number(memberFull.system.stress.value) + scars, memberFull.system.stress.max), 0);
            await BladesHelpers.tryUpdate(memberFull, {system: {stress: {'==value': resultStress}}});
            cutLooseScarMessage += ` ${game.i18n.format('BITD.StartMissionNoCutLooseScarPilotEffect', {pilot: memberFull.name, num: scars})}`;
          }
          if (cutLooseScarMessage)
            messageContents += `<div class="description"><p>${game.i18n.localize('BITD.StartMissionNoCutLooseScarEffect')}${cutLooseScarMessage}</p></div>`;
        }

        // Reset Downtime Activities and Spark for all Pilots
        let sparkUsed = false;
        for (let member of Object.values(this.actor.system.members)) {
          let memberFull = BladesHelpers.resolveActor(member.uuid);
          if (!memberFull || memberFull.type != 'character') continue;
          sparkUsed ||= !memberFull.system.spark;
          await BladesHelpers.tryUpdate(memberFull, {system: {'==downtime_activities': {train_types: {}}, '==spark': true}});
        }
        if (sparkUsed)
          messageContents += `<div class="description"><p>${game.i18n.localize('BITD.StartMissionRecoverSpark')}</p></div>`;


        // Set Phase to Mission
        await BladesHelpers.tryUpdate(this.actor, {system: {'==phase': 'mission'}});

        let speaker = {
          actor: this.actor._id,
          alias: this.actor.name,
          scene: null,
          token: this.actor.prototypeToken._id
        };
        let messageData = {
          speaker: speaker,
          content: await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/start-mission.html', { contents: messageContents })
        }
        BeamChatMessage.create(messageData);
      }
    });
    await dialog.render(true);
  }

  /**
   * Call a popup for finishing a mission.
   */
  async endMissionPopup() {
    let extraData = {};

    let patronFactionFull = BladesHelpers.resolveActor(this.actor.system.faction);
    let factionBonus = {text: game.i18n.localize('BITD.None'), rewards: {}};
    if (!patronFactionFull)
      factionBonus = {text: game.i18n.localize('BITD.Independent'), rewards: {reputation: 2}};
    else {
      let factionType = BladesHelpers.resolveOwnedItem(patronFactionFull.system.type, 'faction_type', null, game);
      // TODO: Remove this, this is a temporary fix
      if (!factionType) {
        for (let pack of game.packs)
          await pack.getDocuments();
        factionType = BladesHelpers.resolveOwnedItem(patronFactionFull.system.type, 'faction_type', null, game);
      }
      if (factionType)
        factionBonus = {text: factionType.name, rewards: foundry.utils.deepClone(factionType.system.rewards)};
    }
    let factionBonusText = `${factionBonus.text} (${Object.values(factionBonus.rewards).length ? Object.entries(factionBonus.rewards).map(r => `${game.i18n.localize(`BITD.${BladesHelpers.capitalize(r[0])}`)} ${r[1] > 0 ? '+' : ''}${r[1]}`).join(', ') : game.i18n.localize('BITD.None')})`;
    let factionGoals = patronFactionFull ? Object.entries(patronFactionFull.system.goals).filter(g => Number(g[1].clock.value) < Number(g[1].clock.max)).map((g, i) => `<option value="${g[0]}"${i == 0 ? ' selected' : ''}>${g[1].title}</option>`).join('') : '';

    extraData.patronFaction = patronFactionFull;
    extraData.independentSupplyRoll = game.i18n.localize(`BITD.EndMissionSupplyRollIndependent${this.actor.system.friends_in_high_places ? '' : 'None'}`);
    extraData.airfieldSupply = this.actor.system.airfield_supply;
    extraData.trophiesRoom = this.actor.system.trophies_room;
    extraData.scorchedEarth = this.actor.system.scorched_earth;
    extraData.highSociety = this.actor.system.high_society;
    extraData.justPassingThrough = this.actor.system.just_passing_through;
    extraData.region = BladesHelpers.resolveActor(this.actor.system.region);
    extraData.regionFaction = BladesHelpers.resolveActor(this.actor.system.owner);
    if (extraData.regionFaction?.type != 'faction')
      extraData.regionFaction = BladesHelpers.resolveActor(extraData.regionFaction?.system.faction);

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('BITD.EndMission')}` },
      content: await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/popups/end-mission.html', { faction_bonus: factionBonusText, faction_goals: factionGoals, rep_tiers: Array(6).fill().map((_, i) => `<option value="${i}"${i == 0 ? ' selected' : ''}>${i}</option>`).join(''), extraData: extraData}),
      classes: ['end-mission'],
      buttons: [
        {
          icon: 'fas fa-bed',
          label: game.i18n.localize('BITD.EndMission'),
          action: 'end-mission',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'end-mission') return;

        let messageContents = '';

        if (dialog.element.querySelector('[name="factionBonus"]').checked && Object.values(factionBonus.rewards).length > 0) {
          let updateObject = {system: {}};
          let bonusMessage = '';
          if (factionBonus.rewards.materiel) {
            updateObject.system.materiel = {'==value': Math.min(Math.max(Number(this.actor.system.materiel.value) + factionBonus.rewards.materiel, 0), Number(this.actor.system.materiel.max))};
            bonusMessage += ` ${game.i18n.format(`BITD.GenericSquad${factionBonus.rewards.materiel < 0 ? 'Loss' : 'Gain'}`, {num: Math.abs(factionBonus.rewards.materiel), name: game.i18n.localize('BITD.Materiel'), reason: game.i18n.localize('BITD.EndMissionFromFactionBonus')})}`;
          }
          if (factionBonus.rewards.personnel) {
            updateObject.system.personnel = {'==value': Math.min(Math.max(Number(this.actor.system.personnel.value) + factionBonus.rewards.personnel, 0), Number(this.actor.system.personnel.max))};
            bonusMessage += ` ${game.i18n.format(`BITD.GenericSquad${factionBonus.rewards.personnel < 0 ? 'Loss' : 'Gain'}`, {num: Math.abs(factionBonus.rewards.personnel), name: game.i18n.localize('BITD.Personnel'), reason: game.i18n.localize('BITD.EndMissionFromFactionBonus')})}`;
          }
          if (factionBonus.rewards.trust)
            bonusMessage += ` ${(await BladesHelpers.handleTrust(patronFactionFull, this.actor, factionBonus.rewards.trust))[0]}`;
          if (factionBonus.rewards.reputation)
            bonusMessage += ` ${await BladesHelpers.handleReputation(this.actor, factionBonus.rewards.reputation, false, game.i18n.localize('BITD.EndMissionFromFactionBonus'))}`;
          BladesHelpers.tryUpdate(this.actor, updateObject);
          messageContents += `<div class="description"><p>${bonusMessage.trimStart()}</p></div>`;
        }
        if (dialog.element.querySelector('[name="rep"]').checked) {
          let repChange = Math.max(2 + Number(dialog.element.querySelector('[name="repTier"]').value) - Number(this.actor.system.tier.value), 0);
          if (dialog.element.querySelector('[name="repHidden"]').checked)
            repChange = 0;
          if (repChange > 0)
            messageContents += `<div class="description"><p>${await BladesHelpers.handleReputation(this.actor, repChange, false, game.i18n.localize('BITD.EndMissionFromFinishingMission'))}</p></div>`;
        }
        if (dialog.element.querySelector('[name="airfield"]')?.checked) {
          messageContents += `<div class="description"><p>${game.i18n.format('BITD.EndMissionAirfieldSupply', {num: this.actor.system.airfield_supply})}</p></div>`;
        }
        if (dialog.element.querySelector('[name="recoverFixUpkeep"]').checked) {
          for (let member of Object.values(this.actor.system.members)) {
            let memberFull = BladesHelpers.resolveActor(member.uuid);
            if (memberFull && memberFull.type == 'character') {
              let memberVehicleFull = BladesHelpers.resolveActor(memberFull?.system.vehicle);
              if (memberVehicleFull)
                BladesHelpers.tryUpdate(memberVehicleFull, {system: {damage: {light: {'==one': '', '==two': ''}}}});
              BladesHelpers.tryUpdate(memberFull, {system: {harm: {light: {'==one': '', '==two': ''}}}});
            }
          }
          messageContents += `<div class="description"><p>${game.i18n.localize('BITD.EndMissionHealUp')}</p></div>`;
        }
        if (dialog.element.querySelector('[name="factionGoal"]').checked && dialog.element.querySelector('[name="factionGoalId"]')) {
          let factionGoalId = dialog.element.querySelector('[name="factionGoalId"]').value;
          let factionGoal = patronFactionFull.system.goals[factionGoalId];
          let factionUpdateObject = {system: {goals: {}}};
          factionUpdateObject.system.goals[factionGoalId] = {clock: {'==value': Number(factionGoal.clock.value) + 1}};
          BladesHelpers.tryUpdate(patronFactionFull, factionUpdateObject);

          let factionGoalMessage = game.i18n.format('BITD.EndMissionFactionGoalUp', {goal: factionGoal.title});
          if (factionUpdateObject.system.goals[factionGoalId].clock['==value'] == Number(factionGoal.clock.max))
            factionGoalMessage += ` ${game.i18n.localize('BITD.EndMissionFactionGoalDone')}`;
          messageContents += `<div class="description"><p>${factionGoalMessage}</p></div>`;
        }
        if (dialog.element.querySelector('[name="trophiesRoom"]')?.checked)
          messageContents += `<div class="description"><p>${await BladesHelpers.handleReputation(this.actor, 1, false, game.i18n.localize('BITD.EndMissionFromTrophiesRoom'))}</p></div>`;

        let titles = [];

        let targetTrust = 0;
        let targetUuid = dialog.element.querySelector('.target-faction .actor-data > .actor-contents')?.dataset.actorId;
        let targetFactionFull = BladesHelpers.resolveActor(targetUuid);
        if (targetFactionFull) {
          if (dialog.element.querySelector('[name="repHidden"]').checked)
            targetTrust = -1;
          else {
            if (dialog.element.querySelector('[name="targetImportantInfrastructure"]').checked) targetTrust -= 2;
            if (dialog.element.querySelector('[name="targetVIPKilled"]').checked) targetTrust -= 2;
            if (dialog.element.querySelector('[name="targetCiviliansDied"]').checked) targetTrust -= 1;
            if (dialog.element.querySelector('[name="targetExposedCorruption"]').checked) targetTrust -= 2;
            if (dialog.element.querySelector('[name="targetSquadCasualties"]').checked) targetTrust -= 1;
            if (dialog.element.querySelector('[name="targetHighProfileTarget"]').checked) targetTrust -= 1;
            if (dialog.element.querySelector('[name="targetControlledTerritory"]').checked) targetTrust -= 1;
            if (dialog.element.querySelector('[name="targetVendetta"]').checked) targetTrust -= 1;
          }
          titles.push({titles: ['target'], actor: targetFactionFull, trust: targetTrust});
        }

        let employerTrust = 0;
        let employerUuid = dialog.element.querySelector('.employer-faction .actor-data > .actor-contents')?.dataset.actorId;
        let employerFactionFull = BladesHelpers.resolveActor(employerUuid);
        if (employerFactionFull) {
          if (dialog.element.querySelector('[name="employerCiviliansDied"]').checked) employerTrust -= 1;
          if (dialog.element.querySelector('[name="employerRoEBroken"]').checked) employerTrust -= 2;
          if (dialog.element.querySelector('[name="employerBadImportantInfrastructure"]').checked) employerTrust -= 2;
          if (dialog.element.querySelector('[name="employerSquadHarmed"]').checked) employerTrust -= 2;
          if (dialog.element.querySelector('[name="employerSuccessfulMission"]').checked) employerTrust += Math.min(Number(dialog.element.querySelector('[name="employerSuccessfulMissionSquadTier"]').value) * 2, 1);
          if (dialog.element.querySelector('[name="employerSecondaryObjective"]').checked) employerTrust += 2;
          if (dialog.element.querySelector('[name="employerVendetta"]').checked) employerTrust -= 1;
          if (dialog.element.querySelector('[name="employerHighSociety"]')?.checked) employerTrust += 1;
          titles.push({titles: ['employer'], actor: employerFactionFull, trust: employerTrust});
        }

        let patronTrust = 0;
        if (patronFactionFull) {
          if (dialog.element.querySelector('[name="patronAnotherFactionHelped"]').checked) patronTrust -= 1;
          if (dialog.element.querySelector('[name="patronInterestsHarmed"]').checked) patronTrust -= 2;
          if (dialog.element.querySelector('[name="patronHighSociety"]')?.checked) patronTrust += 1;
          titles.push({titles: ['patron'], actor: patronFactionFull, trust: patronTrust});
        }

        let localTrust = 0;
        let localFactionFull = extraData.regionFaction;
        if (localFactionFull) {
          if (dialog.element.querySelector('[name="localJustPassingThrough"]')?.checked) localTrust += 1;
          titles.push({titles: ['local'], actor: localFactionFull, trust: localTrust});
        }

        // Delete duplicates, merge trust values
        let toDelete = [];
        for (let [titleId, title] of Object.entries(titles)) {
          let duplicateIndex = titles.findIndex(t => t.actor.uuid == title.actor.uuid);
          if (duplicateIndex != titleId) {
            let duplicateTitle = titles[duplicateIndex];
            duplicateTitle.titles = duplicateTitle.titles.concat(title.titles);
            duplicateTitle.trust += title.trust;
            toDelete.push(titleId);
          }
        }
        for (let indexToDelete of toDelete.reverse())
          titles.splice(indexToDelete, 1);

        let trustRecap = ``;
        for (let title of titles) {
          if (title.titles.length == 1 && title.trust == 0)
            continue;
          let trustText = (await BladesHelpers.handleTrust(title.actor, this.actor, title.trust))[0];
          trustText = trustText.includes('<br/>') ? trustText.match('(?<=\<br\/\>)(.*)', 1)[0] : ''; // Only keep the Status changing part
          let titleText = title.titles.map(t => game.i18n.localize(`BITD.${BladesHelpers.capitalize(t)}`)).join(', ');
          if (game.i18n.lang == 'en') titleText = titleText.replace(/,([^,]*)$/, ' and$1');
          trustRecap += `<p>
            ${game.i18n.format('BITD.EndMissionTrustRecap', {lostGained: game.i18n.localize(`BITD.EndMission${title.trust < 0 ? 'Lost' : 'Gained'}`), num: Math.abs(title.trust), titleText: titleText, faction: title.actor.name})}
            ${trustText}
          </p>`
        }
        messageContents += `<div class="description"><p>${trustRecap}</p></div>`;

        let downtimeActivitiesShift = Number(this.actor.system.extra_downtime);
        if (this.actor.system.vendetta) {
          let vendettasString = BladesHelpers.fetchAllRelationships(this.actor).filter(r => r.status == -3).map(r => BladesHelpers.resolveActor(r.owner)).filter(r => r != null).map(r => r.name).join(', ');
          if (game.i18n.lang == 'en') vendettasString = vendettasString.replace(/,([^,]*)$/, ' and$1');
          downtimeActivitiesShift -= 1;
          messageContents += `<div class="description"><p>${game.i18n.format('BITD.EndMissionVendettaEffect', {vendettas: vendettasString})}</p></div>`;
        }

        // Reset Pilot Downtime Activities
        for (let member of Object.values(this.actor.system.members)) {
          let memberFull = BladesHelpers.resolveActor(member.uuid);
          if (memberFull && memberFull.type == 'character')
            BladesHelpers.tryUpdate(memberFull, {system: {downtime_count: {'==value': Number(memberFull.system.downtime_count.base) + downtimeActivitiesShift}}});
        }

        // Set Phase to Downtime & Reset Cohort Downtime Activity for All Hands
        BladesHelpers.tryUpdate(this.actor, {system: {'==phase': 'downtime', '==cohort_downtime_done': false}});

        let speaker = {
          actor: this.actor._id,
          alias: this.actor.name,
          scene: null,
          token: this.actor.prototypeToken._id
        };
        let messageData = {
          speaker: speaker,
          content: await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/end-mission.html', { contents: messageContents })
        }
        BeamChatMessage.create(messageData);
      }
    });
    await dialog.render(true);

    for (let element of dialog.element.querySelectorAll('.collapse-category legend'))
      element.addEventListener('click', (ev) => {
        let element = ev.currentTarget;
        let fieldSetElement = element.parentElement;
        fieldSetElement.classList.add('collapsed-category');
      });
    for (let element of dialog.element.querySelectorAll('div:has(+ .collapse-category)'))
      element.addEventListener('click', (ev) => {
        let element = ev.currentTarget;
        let fieldSetElement = element.nextElementSibling;
        fieldSetElement.classList.remove('collapsed-category');
      });
    for (let element of dialog.element.querySelectorAll('.faction-category'))
      element.addEventListener('drop', (ev) => {
        ev.preventDefault();
        let element = ev.currentTarget;
        const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
        if (dropData.uuid) {
          let dropFull = BladesHelpers.resolveActor(dropData.uuid);
          if (dropFull.type == 'faction') {
            // Drop a Faction to register it
            element.querySelector('.actor-data').innerHTML = `
              <div class="actor-contents flex-horizontal" data-actor-id="${dropFull.uuid}">
                <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
                <a class="item-name">${dropFull.name}</a>
                <a class="delete-actor"><i class="fas fa-times"></i></a>
              </div>`;
            element.querySelector('.actor-data .delete-actor').addEventListener('click', (ev) => {
              element.querySelector('.actor-data').innerHTML = game.i18n.localize('BITD.None');
            });
          }
        }
    });
  }

  /**
   * Call a popup for finishing a session.
   */
  async endSessionPopup() {
    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('BITD.EndSessionCheatSheet')}` },
      content: await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/popups/end-session.html', {}),
      classes: ['end-session'],
      buttons: [
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Close'),
          action: 'close',
        }
      ],
    });
    await dialog.render(true);
  }

  /**
   * Call a popup for creating a cohort roll.
   */
  async createCohortRollPopup(cohortFull) {
    // Fetch roll modifiers
    let [_, allPermanentModifiers, allConditionalModifiers] = this.actor.getModifiers(cohortFull);
    allPermanentModifiers = await resolveRollModifierArray(allPermanentModifiers, cohortFull);
    allConditionalModifiers = await resolveRollModifierArray(allConditionalModifiers, cohortFull);
    allConditionalModifiers = pruneInvalidConditionalRollModifiers(cohortFull, allConditionalModifiers);

    let rollTypes = ['cohort'];
    let missingRollTypes = {};
    if (this.actor.system.all_hands) {
      rollTypes = rollTypes.concat(['acquireAsset', 'longTermProject', 'schmooze']);
      if (!Object.values(this.actor.system.projects).filter(p => Number(p.clock.value) < Number(p.clock.max)).length) {
        missingRollTypes[game.i18n.localize('BITD.LongTermProjectRoll')] = game.i18n.localize('BITD.BadDowntimeRoll.NoOngoingLTP');
        rollTypes.splice(rollTypes.indexOf('longTermProject'), 1);
      }
    }

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('BITD.CohortRoll')}` },
      content: buildRollPopup(game.i18n.localize('BITD.CohortRoll'), cohortFull, rollTypes, missingRollTypes),
      buttons: [
        {
          icon: 'fas fa-check',
          label: `${game.i18n.localize('BITD.Roll')} (${game.i18n.localize(`BITD.DowntimeCohortRoll${this.actor.system.cohort_downtime_done ? 'Done' : ''}`)})`,
          action: 'roll',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'roll') return;

        let html = $(dialog.element);
        let extraDice = parseInt(html.find('[name="mod"]')[0].value);
        let withinExpertise = html.find('[name="expertise"]')[0].checked;
        let note = html.find('[name="note"]')[0].value;

        // Fetch actor roll modifiers & enabled conditional roll modifiers
        let enabledConditionalModifiers = resolveConditionalModifiers(dialog, cohortFull);
        enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);

        let input = html.find('input[type=radio]:checked');
        if (input.length > 0) {
          let rollType = input[0].id.split('-')[0];
          let diceAmount = cohortFull.system.quality + extraDice;
          let extraFields = { roll_type: rollType, within_expertise: withinExpertise, modifiers: [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ], actor: cohortFull };
          switch (rollType) {
            case 'cohort':
              await bladesRoll(cohortFull.system.quality + extraDice, 'BITD.CohortRoll', note, extraFields);
              break;
            case 'acquireAsset':
              let acquireAssetSuccessTier = html.find('[name="acquireAssetSuccessTier"]')[0].value;
              extraFields.tier = Number(this.actor.system.tier.value);
              extraFields.successTier = acquireAssetSuccessTier;
              await bladesRoll(diceAmount, 'BITD.AcquireAssetRoll', note, extraFields);
              break;
            case 'longTermProject':
              let ltpSelect = dialog.element.querySelector('[name="ltpId"]');
              if (ltpSelect.multiple) {
                extraFields.ltpIds = [];
                for (let selectedOption of ltpSelect.selectedOptions)
                  extraFields.ltpIds.push(selectedOption.value);
              } else
                extraFields.ltpId = ltpSelect.value;
              await bladesRoll(diceAmount, 'BITD.LongTermProjectRoll', note, extraFields);
              break;
            case 'schmooze':
              let schmoozeFactionUuid = html.find('#schmoozeFaction > .actor-contents').data('actorId');
              let schmoozeFactionFull = BladesHelpers.resolveActor(schmoozeFactionUuid);
              extraFields.schmoozeFaction = schmoozeFactionFull;
              await bladesRoll(diceAmount, 'BITD.SchmoozeRoll', note, extraFields);
              break;
            default:
              break;
          }
          if (rollType != 'cohort')
            await BladesHelpers.tryUpdate(this.actor, {system: {'==cohort_downtime_done': true}});
          await postRollProcessing(this.actor, extraFields);
        }
      }
    });
    dialog.allPermanentModifiers = allPermanentModifiers;
    dialog.allConditionalModifiers = allConditionalModifiers;
    dialog.attributeName = '';
    dialog.rollTypes = rollTypes;
    dialog._onFirstRender = dialogOnFirstRender;
    dialog._onRender = function(context, options) {
      dialogOnRender(context, options, this);

      let input = this.element.querySelector('input[type=radio]:checked');
      if (input.length > 0) {
        let allowedToRoll = true;
        let rollType = input.id.split('-')[0];
        if (rollType == 'schmooze') {
          let schmoozeFaction = this.element.querySelector('#schmoozeFaction > .actor-contents').dataset.actorId;
          allowedToRoll = schmoozeFaction != null;
        }

        allowedToRoll &&= (rollType == 'cohort' || checkDowntimeRules(dialog));
        this.element.querySelector('[data-action="roll"]').disabled = !allowedToRoll;
      }
    };
    dialog.refreshModifiers = refreshModifiers;
    dialog.actor = this.actor;
    await dialog.render(true);

    dialog.element.addEventListener('drop', (ev) => {
      let element = ev.currentTarget;
      ev.preventDefault();
      const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
      if (dropData.uuid) {
        let dropFull = BladesHelpers.resolveActor(dropData.uuid);
        if (dropFull.type == 'faction') {
          let rollType = element.querySelector('input[type=radio]:checked').id.split('-')[0];
          if (rollType == 'schmooze')
            element.querySelector('[data-action="roll"]').disabled = !checkDowntimeRules(dialog);
          element.querySelector('#schmoozeFaction').innerHTML = `
            <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
              <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
              <a class="item-name">${dropFull.name}</a>
              <a class="delete-actor"><i class="fas fa-times"></i></a>
            </div>`;
          element.querySelector('#schmoozeFaction .delete-actor').addEventListener('click', (ev) => {
            let element = ev.currentTarget;
            let rollButton = element.closest('.window-content').querySelector('button[data-action="roll"]');
            let rollType = element.closest('.form-group').querySelector('input[type=radio]:checked').id.split('-')[0];
            if (rollType == 'schmooze')
              rollButton.disabled = true;
            element.closest('#schmoozeFaction').innerHTML = game.i18n.localize('BITD.None');
          });
        }
      }
    });
    for (let element of dialog.element.querySelectorAll('input[type=radio]')) {
      element.addEventListener('click', (ev) => {
        let element = ev.currentTarget;
        let rollType = element.id.split('-')[0];
        let rollButton = element.closest('.window-content').querySelector('button[data-action="roll"]');
        let allowedToRoll = true;
        if (rollType == 'schmooze')
          allowedToRoll = element.closest('.radio-group').querySelector('#schmoozeFaction > .actor-contents') != null;
        allowedToRoll &&= (rollType == 'cohort' || checkDowntimeRules(dialog));
        rollButton.disabled = !allowedToRoll;
      });
    }
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Update Tier: Update Cohorts & Hold
    html.find('input[name="system.tier.value"]').click(async ev => {
      let element = ev.currentTarget;
      let newTier = Number(element.value);
      if (newTier != this.actor.system.tier.value)
        await this.actor.update({system: {'==hold': newTier > Number(this.actor.system.tier.value) ? 'weak' : 'strong'}});
      await this.actor.update({system: {tier: {'==value': newTier}}});
      for (let cohort of this.actor.items.filter(i => i.type == 'cohort'))
        await cohort.updateCohortQualityScale();
    });

    // Add a new Cohort
    html.find('.add-item').click(async ev => {
      await BladesHelpers._addOwnedItem(ev, this.actor);
    });

    html.find('.is-player-crew > input').change(async ev => {
      let maxTier = $(ev.currentTarget).checked ? 4 : 5;
      let valueTier = Math.min(maxTier, this.actor.system.tier.value);
      let updateObject = {system: { tier: {'==max': maxTier, '==value': valueTier}}};
      await BladesHelpers.tryUpdate(this.actor, updateObject);
    });

    // Cohort Block Harm handler
    html.find('.cohort-block-harm input[type="radio"]').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let itemId = element.data('itemId');
      let harmId = $(ev.currentTarget).val();
      await this.actor.updateEmbeddedDocuments('Item', [{_id: itemId, 'system.harm': harmId}]);
    });

    html.find('.cohort-armor').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let itemId = element.data('itemId');
      let armor = ev.currentTarget.checked;
      await this.actor.updateEmbeddedDocuments('Item', [{_id: itemId, 'system.armor': armor}]);
    })

    html.find('.cohort-block-wrapper .add-cohort-roll').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let cohortId = element.data('itemId');
      let cohortFull = this.actor.items.filter(i => i._id == cohortId)[0];
      await this.createCohortRollPopup(cohortFull);
    })

    html.find('.add-group-action').click(async ev => {
      await this.createGroupActionPopup();
    })

    html.find('.start-mission').click(async ev => {
      await this.startMissionPopup();
    })

    html.find('.end-mission').click(async ev => {
      await this.endMissionPopup();
    })

    html.find('.end-session').click(async ev => {
      await this.endSessionPopup();
    })

    // Remove Squad from character sheet
    html.find('.delete-faction').click(async ev => {
      await BladesHelpers.removeFactionSquad(this.actor);
    });

    // Remove Region from character sheet
    html.find('.delete-region').click(async ev => {
      await BladesHelpers.removeSquadRegion(this.actor);
    });

    // Remove Crew Reputation from crew sheet
    html.find('.delete-reputation').click(async ev => {
      let element = $(ev.currentTarget).closest('.item');
      let item = this.actor.items.get(element.data('itemId'));
      if (element.parent().hasClass('item-with-container'))
        element = element.parent();
      element.slideUp(200, async () => {
        await this.actor.removeItem(item);
        await BladesHelpers.tryUpdate(this.actor, {system: {'==crew_reputation': null}});
      });
    });

    // Remove Squad from character sheet
    html.find('.delete-member').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let memberFull = BladesHelpers.resolveActor(element.data('itemId'));
      if (memberFull)
        await BladesHelpers.removeSquadCharacter(memberFull);
    });

    // Add project
    html.find('.add-project').click(async ev => {
      let projects = this.actor.system.projects;
      projects[Object.keys(projects).length] = {
        title: '',
        clock: {
          value: 0,
          max: 4,
          min: 0,
          theme_color: null
        },
        description: ''
      }
      await BladesHelpers.tryUpdate(this.actor, {system: {'==projects': projects}});
    });

    // Delete Project
    html.find('.delete-project').click(async ev => {
      let target = ev.currentTarget;
      const element = target.closest('.item');
      let currentProjectId = element.dataset.projectId;
      let projectsEntries = Object.entries(this.actor.system.projects);
      projectsEntries.splice(currentProjectId, 1);
      for (let id in projectsEntries)
        projectsEntries[id][0] = String(id);
      await BladesHelpers.tryUpdate(this.actor, {system: {'==projects': Object.fromEntries(projectsEntries)}});
      // TODO: Slide up animation 200ms: element.slideUp(200, async () => await BladesHelpers.tryUpdate(this.actor, {system: {'==projects': Object.fromEntries(projectsEntries)}}));
    });

    // Update Item Uses
    html.find('.uses > input').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {system: {uses: {'==value': ev.currentTarget.value}}});
    });

    // Update Upgrade Cohort Choice
    html.find('.cohort-choice > select').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      const selectedCohort = ev.currentTarget.value;
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {system: {'==barracks_cohort_id': selectedCohort}});
    });

    // Update Training Center Fire Team Type
    html.find('.training-center > select').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      const selectedType = ev.currentTarget.value;
      let item = this.actor.items.get(currentItemId);
      let oldSelectedType = item.system.training_center_type;
      await BladesHelpers.updateTrainingCenterType(this.actor, oldSelectedType, selectedType);
      await BladesHelpers.tryUpdate(item, {system: {'==training_center_type': selectedType}});
    });

    // Roll Collection Agency
    html.find('.collection-agency > button').click(async ev => {
      let extraFields = { title: game.i18n.localize('BITD.CollectionAgency'), contents: 'BITD.CollectionAgencyContents', modifiers: [], actor: this.actor };
      await bladesRoll(Number(this.actor.system.tier.value), 'BITD.CollectionAgency', '', extraFields);
    });

    // Roll Side Business Agency
    html.find('.side-business > button').click(async ev => {
      let extraFields = { title: game.i18n.localize('BITD.SideBusiness'), contents: 'BITD.SideBusinessContents', modifiers: [], actor: this.actor };
      await bladesRoll(Number(this.actor.system.tier.value), 'BITD.SideBusiness', '', extraFields);
    });

    // Collapse children relationship list
    html.find('.collapse').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let relationshipUuid = element.data('itemId');
      let relationships = this.actor.system.relationships;
      let [relationshipId, relationshipFull] = Object.entries(relationships).find(r => r[1].uuid == relationshipUuid) ?? [-1, null];
      if (relationshipId == -1) return;

      let factionUpdate = {system: {relationships: {}}};
      factionUpdate.system.relationships[relationshipId] = {'==collapsed': !relationshipFull.collapsed};
      let childrenElement = $(element[0].parentElement).children('.relationship-child-list');
      childrenElement.slideToggle(200, async () => await BladesHelpers.tryUpdate(this.actor, factionUpdate));
    });
  }

  /* -------------------------------------------- */
}
