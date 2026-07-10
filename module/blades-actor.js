import { bladesRoll, buildRollPopup, resolveRollModifierArray, resolveConditionalModifiers,
  dialogOnFirstRender, dialogOnRender, refreshModifiers, postRollProcessing, pruneInvalidConditionalRollModifiers,
  keepValidModifiersFromRollType, keepValidModifiersFromOther, computeGroupActionResultAndSendMessage, effectIndex,
  bladesRollModifierList
} from "./blades-roll.js";
import { BladesHelpers } from "./blades-helpers.js";

/**
 * Extend the basic Actor
 * @extends {Actor}
 */
export class BladesActor extends Actor {

  /** @override */
  static async create(data, options={}) {
    data.prototypeToken = data.prototypeToken || {};

    // For Squad and Character set the Token to sync with charsheet.
    switch (data.type) {
      case 'faction':
      case 'region':
      case 'crew':
      case 'character':
      case 'vehicle':
      case 'npc':
      case '\uD83D\uDD5B clock':
        data.prototypeToken.actorLink = true;
        break;
    }

    return super.create(data, options);
  }

  /** @override */
  async _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if (changed.system?.is_second_form != undefined)
      this.updateVehicleForm();
  }

  /** @override */
  static async _preDeleteOperation(documents, operation, user) {
    let removeSingle = async function(obj, removeFunc, removeFuncArg) {
      if (obj) {
        if (obj.uuid)
          obj = obj.uuid;
        let objFull = BladesHelpers.resolveActor(obj);
        if (objFull)
          await removeFunc(removeFuncArg ?? objFull);
      }
    };
    let removeArray = async function(array, removeFunc) {
      for (let obj of array)
        await removeSingle(obj, removeFunc);
    };

    for (let document of documents) {
      // Data cleanup
      switch (document.type) {
        case 'faction':
          await removeArray(Object.values(document.system.squads), BladesHelpers.removeFactionSquad);
          await removeArray(document.system.npcs, BladesHelpers.removeFactionNPC);
          await removeArray(document.system.regions, BladesHelpers.removeRegionOwner);
          await removeArray(document.system.vehicles, BladesHelpers.removeFactionVehicle);
          break;
        case 'crew':
          await removeSingle(document.system.faction, BladesHelpers.removeFactionSquad, document);
          await removeSingle(document.system.region, BladesHelpers.removeSquadRegion, document);
          await removeArray(Object.values(document.system.members), async (removeFuncArg) => {
            if (removeFuncArg.type == 'character') await BladesHelpers.removeSquadCharacter(removeFuncArg);
            if (removeFuncArg.type == 'npc') await BladesHelpers.removeSquadNPC(removeFuncArg);
          });
          break;
        case 'character':
          await removeSingle(document.system.crew, BladesHelpers.removeSquadCharacter, document);
          await removeSingle(document.system.vehicle, BladesHelpers.removeCharacterVehicle, document);
          await removeSingle(document.system.region, BladesHelpers.removeCharacterRegion, document);
          break;
        case 'region':
          await removeSingle(document.system.owner, BladesHelpers.removeRegionOwner, document);
          await removeArray(document.system.squads, BladesHelpers.removeSquadRegion);
          await removeArray(document.system.characters, BladesHelpers.removeCharacterRegion);
          await removeArray(document.system.npcs, BladesHelpers.removeNPCRegion);
          break;
        case 'vehicle':
          await removeSingle(document.system.faction, BladesHelpers.removeFactionVehicle, document);
          await removeSingle(document.system.pilot, BladesHelpers.removeCharacterVehicle);
          break;
        case 'npc':
          await removeSingle(document.system.faction, BladesHelpers.removeFactionNPC, document);
          await removeSingle(document.system.region, BladesHelpers.removeNPCRegion, document);
          await removeSingle(document.system.crew, BladesHelpers.removeSquadNPC, document);
          break;
      }

      // Remove from all relationships
      if (['faction', 'crew', 'character', 'npc'].includes(document.type))
        for (let relationship of BladesHelpers.fetchAllRelationships(document)) {
          let entityFull = BladesHelpers.resolveActor(relationship.owner);
          if (entityFull && document.type == 'crew')
            await BladesHelpers.removeRelationship(entityFull, document);
        }

      // Remove from all character connections
      if (['character', 'npc'].includes(document.type))
        for (let characterFull of await BladesHelpers.getAllObjectDocumentsByType('character', [document], game)) {
          let connectionId = Object.values(characterFull.system.connections).indexOf(Object.values(characterFull.system.connections).find(c => c.uuid == document.uuid));
          if (connectionId >= 0) {
            let connectionsEntries = Object.entries(characterFull.system.connections);
            connectionsEntries.splice(connectionId, 1);
            for (let id in connectionsEntries)
              connectionsEntries[id][0] = String(id);
            await BladesHelpers.tryUpdate(characterFull, {'system.==connections': Object.fromEntries(connectionsEntries)});
          }
        }
    }

    super._onDeleteOperation(documents, operation, user);
  }

  /* -------------------------------------------- */

  /** @override */
  getRollData() {
    const rollData = super.getRollData();
    rollData.diceAmount = this.getAttributeDiceToThrow();
    return rollData;
  }

  /* -------------------------------------------- */

  getAttributes(forcedAttributes) {
    let attributes = forcedAttributes ?? foundry.utils.deepClone(this.system.attributes);
    if (this.system.vehicle) {
      let vehicleFull = BladesHelpers.resolveActor(this.system.vehicle);
      if (vehicleFull)
        for (let [attributeName, attribute] of Object.entries(vehicleFull.system.attributes)) {
          let characterAttribute = attributes[attributeName];
          characterAttribute.exp = attribute.exp;
          characterAttribute.exp_max = attribute.exp_max;

          for (let [skillName, skill] of Object.entries(attribute.actions)) {
            let characterSkill = attributes[attributeName].actions[skillName];
            characterSkill.first_form = skill.first_form;
            characterSkill.second_form = skill.second_form;
            characterSkill.max = Math.min(characterSkill.max, characterSkill.max);
            characterSkill.min = Math.min(characterSkill.min + skill.min, characterSkill.max);
            characterSkill.value = Math.max(Math.min(characterSkill.value + skill.value, characterSkill.max), characterSkill.min);
          }
        }
    }
    return attributes;
  }

  /**
   * Calculate Attribute Dice to throw.
   */
  getAttributeDiceToThrow() {
    // Calculate Dice to throw.
    let diceAmount = {};
    let attributes = this.getComputedAttributes(this.system.modifiers?.mastery);

    for (var attributeName in attributes) {
      diceAmount[attributeName] = 0;
      for (var actionName in attributes[attributeName].actions) {
        let value = parseInt(attributes[attributeName].actions[actionName]['value']);
        // Get vehicle form bonus
        if (this.type == 'character' && this.system.more_than_meets_the_eye && this.system.vehicle && ['expertise', 'acuity'].includes(attributeName)) {
          let vehicleFull = BladesHelpers.resolveActor(this.system.vehicle);
          if (vehicleFull) {
            let formBonus = vehicleFull.system.is_second_form ? 'second_form' : 'first_form';
            value += parseInt(attributes[attributeName].actions[actionName][formBonus]);
          }
        }
        diceAmount[actionName] = value;

        // We add a +1d for every action higher than 0.
        if (diceAmount[actionName] > 0)
          diceAmount[attributeName]++;
      }
    }

    return diceAmount;
  }

  /* -------------------------------------------- */

  async handleCombinedArms(isActive, element, fromMessage = false) {
    let containerElement = element.parentElement;
    let effectsElement = containerElement.querySelector('[data-field="BITD.Effects"], [field="BITD.Effects"]');
    let effectListElement = containerElement.querySelector('.effect-list');
    let effectsElementParent = (isActive ? effectsElement : effectListElement).parentElement;
    if (!isActive) {
      effectsElement.remove();
      effectListElement.remove();
      effectsElement = document.createElement('select');
      effectsElementParent.appendChild(effectsElement);
      effectsElement.setAttribute('field', 'BITD.Effects');
      effectsElement.setAttribute('multiple', '');
      effectsElement.dataset.tooltip = game.i18n.localize('BITD.MultipleSelectUsage');
      let first = true;
      for (let effect of bladesRollModifierList.assist.fields['BITD.Effects']) {
        let effectOptionElement = document.createElement('option');
        effectsElement.appendChild(effectOptionElement);
        effectOptionElement.value = effect;
        if (first)
          effectOptionElement.selected = true;
        effectOptionElement.innerText = game.i18n.localize(effect);
        first = false;
      }
    } else {
      effectsElement.remove();
      effectListElement = document.createElement('div');
      effectListElement.classList.add('effect-list', 'flex-vertical');
      effectsElementParent.appendChild(effectListElement);
      for (let effect of bladesRollModifierList.assist.fields['BITD.Effects']) {
        let effectOptionElement = document.createElement('div');
        effectListElement.appendChild(effectOptionElement);
        effectOptionElement.dataset.name = effect;
        effectOptionElement.innerText = game.i18n.localize(effect);
      }
      for (let element of effectListElement.querySelectorAll('div')) {
        element.addEventListener('click', (event) => {
          let element = event.currentTarget;
          let effectsElement = containerElement.querySelector('[data-field="BITD.Effects"]');
          let newEffectElement = document.createElement('div');
          effectsElement.appendChild(newEffectElement);
          newEffectElement.classList.add('flex-horizontal');
          newEffectElement.dataset.value = element.dataset.name;
          let labelElement = document.createElement('label');
          newEffectElement.appendChild(labelElement);
          labelElement.innerText = game.i18n.localize(`${element.dataset.name}${fromMessage ? 'Short' : ''}`);
          let aElement = document.createElement('a');
          newEffectElement.appendChild(aElement);
          aElement.innerHTML = '<i class="fas fa-trash"></i>';
          aElement.addEventListener('click', (event) => {
            let element = event.currentTarget;
            element.parentElement.remove();
          });
        });
      }
      effectsElement = document.createElement('div');
      (fromMessage ? element : containerElement).appendChild(effectsElement);
      effectsElement.outerHTML = `
        <div class="flex-vertical" data-field="BITD.Effects">
          <label>${game.i18n.localize('BITD.ChosenEffects')}</label>
        </div>`;
    }
  }

  async rollAttributePopup(attributeName, groupActionData) {
    if (this.type == 'vehicle') {
      ui.notifications.warn(game.i18n.localize('BITD.log.warn.NoRollFromVehicle'));
      return;
    }

    let attributeLabel = BladesHelpers.getRollLabel(attributeName);

    // Fetch roll modifiers
    let [_, allPermanentModifiers, allConditionalModifiers] = this.getModifiers();
    allPermanentModifiers = await resolveRollModifierArray(allPermanentModifiers, this, attributeName);
    allConditionalModifiers = await resolveRollModifierArray(allConditionalModifiers, this, attributeName);
    allConditionalModifiers = pruneInvalidConditionalRollModifiers(this, allConditionalModifiers);

    let isAction = BladesHelpers.isAttributeAction(attributeName);
    let title = game.i18n.format(`BITD.${isAction ? 'Action' : 'Attribute'}RollTitle`, { attribute: game.i18n.localize(attributeLabel) });
    let rollTypes = groupActionData ? ['groupAction'] : isAction ? ['actionRoll'] : ['resistance'];
    let dialog = new foundry.applications.api.DialogV2({
      window: { title: title },
      content: buildRollPopup(title, this, rollTypes),
      buttons: [
        {
          icon: "fas fa-check",
          label: game.i18n.localize('BITD.Roll'),
          action: "roll"
        },
        {
          icon: "fas fa-times",
          label: game.i18n.localize('Close'),
          action: "close"
        },
      ],
      submit: async (result, dialog) => {
        if (result != "roll") return;

        let html = $(dialog.element);
        let extraDice = parseInt(html.find('[name="mod"]')[0].value);
        let note = html.find('[name="note"]')[0].value;
        let actionDiceAmount = this.getRollData().diceAmount[attributeName] + extraDice;

        // Fetch enabled conditional roll modifiers by HTML inspection
        let enabledConditionalModifiers = resolveConditionalModifiers(dialog, this, attributeName);
        enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);

        let input = html.find("input[type=radio]:checked");
        if (input.length > 0) {
          let rollType = input[0].id.split('-')[0];
          enabledConditionalModifiers = keepValidModifiersFromRollType(enabledConditionalModifiers, rollType, groupActionData ? groupActionData.position : dialog.element.querySelector('[name="pos"]')?.value, dialog.attributeName);
          let extraFields = { roll_type: rollType, modifiers: [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ], actor: this };
          switch (rollType) {
            case 'actionRoll':
            case 'groupAction':
              let attribute = BladesHelpers.getAttributeFromAction(attributeName);
              extraFields.dire = this.system.stress.value == this.system.stress.max;
              if (['expertise', 'acuity'].includes(attribute) && this.hasValidVehicle())
                extraFields.vehicleDire = !Object.values(this.getVehicleData('system.quirks')).find(q => q.usable);
              extraFields.lastStand = this.system.modifiers.last_stand;
              extraFields.group_action = groupActionData;

              let position, forcedPosition, effect, forcedEffect;
              if (groupActionData) {
                position = extraFields.group_action.position;
                forcedPosition = extraFields.group_action.forcedPosition;
                effect = extraFields.group_action.effect;
                forcedEffect = extraFields.group_action.forcedEffect;
              } else {
                position = html.find('[name="pos"]')[0].value;
                forcedPosition = html.find('[name="forcedPos"]')[0].checked;
                effect = html.find('[name="effect"]')[0].value;
                forcedEffect = html.find('[name="forcedEffect"]')[0].checked;
              }
              await this.rollAttribute(attributeName, extraDice, position, forcedPosition, effect, forcedEffect, note, extraFields);
              break;
            case 'resistance':
              if (["expertise", "acuity"].includes(attributeName)) extraFields.noRoll = true;
              extraFields.resistance_attribute = attributeName;
              await bladesRoll(actionDiceAmount, "BITD.ResistanceRoll", note, extraFields);
              break;
            default:
              ui.notifications.warn(game.i18n.format('BITD.log.warn.UnknownRollType', { type: rollType }));
          }
          await postRollProcessing(this, extraFields);
        }
      }
    })
    dialog.allPermanentModifiers = allPermanentModifiers;
    dialog.allConditionalModifiers = allConditionalModifiers;
    dialog.attributeName = attributeName;
    dialog.rollTypes = rollTypes;
    dialog._onFirstRender = dialogOnFirstRender;
    dialog._onRender = function(context, options) {
      dialogOnRender(context, options, this);

      // Connection update & Trigger it
      let connectionSelector = this.element.querySelector('.modifier[data-modifier="assist"] select[field="BITD.Connection"]');
      if (connectionSelector) {
        connectionSelector.addEventListener('change', (event) => {
          let modifierElement = connectionSelector.closest('.modifier');
          let connectionSelectElementVal = $(modifierElement).find('span:first-of-type select').val();
          if (!connectionSelectElementVal)
            return;
          let connectionValue = BladesHelpers.fetchConnectionsToActor(this.actor.uuid).find(c => c.uuid == connectionSelectElementVal).clock.value;
          let effectsLabelElement = modifierElement.querySelector('span:last-of-type label');
          if (effectsLabelElement)
            effectsLabelElement.innerText = `${game.i18n.localize('BITD.Effects')} (${game.i18n.format('BITD.ChooseX', {num: connectionValue})})`;

          let connectionFull = BladesHelpers.resolveActor(connectionSelectElementVal);
          let tacticalGeniusElement = connectionSelector.closest('.modifier[data-modifier="assist"]').querySelector('input[name="BITD.TacticalGenius"]');
          let tacticalGeniusFieldGroup = tacticalGeniusElement.parentElement;
          let activeTacticalGenius = connectionFull.system.tactical_genius && connectionFull.system.tactical_genius_uses.value > 0;
          if (!activeTacticalGenius)
            tacticalGeniusElement.checked = false;
          tacticalGeniusFieldGroup.style.display = activeTacticalGenius ? null : 'none';

          let combinedArmsElement = connectionSelector.closest('.modifier[data-modifier="assist"]').querySelector('input[name="BITD.CombinedArms"]');
          let combinedArmsFieldGroup = combinedArmsElement.parentElement;
          let squadFull = BladesHelpers.resolveActor(this.actor.system.crew);
          let activeCombinedArms = squadFull?.system.combined_arms;
          if (!activeCombinedArms)
            combinedArmsElement.checked = false;
          combinedArmsFieldGroup.style.display = activeCombinedArms ? null : 'none';
        });

        var event = new Event('change');
        connectionSelector.dispatchEvent(event);
      }

      // Update the HTML in case of Combined Arms
      let combinedArmsSelector = this.element.querySelector('.modifier[data-modifier="assist"] input[name="BITD.CombinedArms"]');
      if (combinedArmsSelector) {
        combinedArmsSelector.addEventListener('change', async (event) => {
          let combinedArmsActive = event.currentTarget.checked;
          await this.actor.handleCombinedArms(combinedArmsActive, combinedArmsSelector.parentElement);
        });
      }
    };
    dialog.refreshModifiers = refreshModifiers;
    dialog.actor = this;
    dialog.render(true);
  }

  /* -------------------------------------------- */

  async workHardPlayHardRoll(otherPilotUuid, firstRollResult) {
    // Fetch roll modifiers
    let [_, allPermanentModifiers, allConditionalModifiers] = this.getModifiers();
    allPermanentModifiers = await resolveRollModifierArray(allPermanentModifiers, this);
    allConditionalModifiers = await resolveRollModifierArray(allConditionalModifiers, this);
    allConditionalModifiers = pruneInvalidConditionalRollModifiers(this, allConditionalModifiers);

    let otherPilotFull = BladesHelpers.resolveActor(otherPilotUuid);
    let title = game.i18n.format(`BITD.ActionRollTitle`, { attribute: game.i18n.localize(`BITD.StressLoss`) });
    let dialog = new foundry.applications.api.DialogV2({
      window: { title: title },
      content: buildRollPopup(title, this, ['stressLoss'], {}, true),
      buttons: [
        {
          icon: "fas fa-check",
          label: game.i18n.localize('BITD.Roll'),
          action: "roll"
        },
        {
          icon: "fas fa-times",
          label: game.i18n.localize('Close'),
          action: "close"
        },
      ],
      submit: async (result, dialog) => {
        if (result != "roll") return;

        let extraDice = parseInt(dialog.element.querySelector('[name="mod"]').value);
        let note = dialog.element.querySelector('[name="note"]').value;

        // Fetch enabled conditional roll modifiers by HTML inspection
        let enabledConditionalModifiers = resolveConditionalModifiers(dialog, this);
        enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);
        enabledConditionalModifiers = keepValidModifiersFromRollType(enabledConditionalModifiers, 'stressLoss', null, dialog.attributeName);

        let extraFields = { title: game.i18n.localize('BITD.StressLoss'), roll_type: 'stressLoss', modifiers: [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ], actor: this, connection: otherPilotFull, workHardPlayHardRoll: true, bonusRoll: true };
        let stress = Number(this.system.stress.value);
        extraFields.stress = parseInt(stress);
        if (firstRollResult == 'failure')
          extraFields.forcedResult = firstRollResult;
        let connection = Object.values(this.system.connections).find(c => c.uuid == otherPilotUuid);
        let stressLossDiceAmount = Number(connection.clock.value) + extraDice;
        await bladesRoll(stressLossDiceAmount, 'BITD.StressLoss', note, extraFields);
        await postRollProcessing(this, extraFields);
      }
    })
    dialog.allPermanentModifiers = allPermanentModifiers;
    dialog.allConditionalModifiers = allConditionalModifiers;
    dialog.attributeName = '';
    dialog.rollTypes = ['stressLoss'];
    dialog._onFirstRender = dialogOnFirstRender;
    dialog._onRender = dialogOnRender;
    dialog.refreshModifiers = refreshModifiers;
    dialog.actor = this;
    await dialog.render(true);
  }

  /* -------------------------------------------- */

  async rollAttribute(attributeName = "", additionalDiceAmount = 0, position, forcedPosition, effect, forcedEffect, note, extraFields = {}) {
    let diceAmount = 0;

    if (attributeName !== "")
      diceAmount += this.getRollData().diceAmount[attributeName];
    else
      diceAmount = 1;

    // Dire Action + Last Stand
    if (extraFields.dire && extraFields.lastStand)
      diceAmount += parseInt(this.getVehicleData('system.breakdown'));
    diceAmount += additionalDiceAmount;

    await bladesRoll(diceAmount, attributeName, note, { additionalDiceFromActionRoll: additionalDiceAmount, position: position, forcedPosition: forcedPosition, effect: effect, forcedEffect: forcedEffect, ...extraFields });
  }

  /* -------------------------------------------- */

  getComputedAttributes(hasMastery) {
    let attributes = this.getAttributes();
    for (const a in attributes)
      for (const s in attributes[a].actions) {
        if (attributes[a].actions[s].max !== 3 && !hasMastery)
          attributes[a].actions[s].max = 3;
        else if (attributes[a].actions[s].max !== 4 && hasMastery)
          attributes[a].actions[s].max = 4;

        // Include Active Effect alterations to action minimums
        if (attributes[a].actions[s].value <= attributes[a].actions[s].min)
          attributes[a].actions[s].value = attributes[a].actions[s].min;
        if (attributes[a].actions[s].value >= attributes[a].actions[s].max)
          attributes[a].actions[s].value = attributes[a].actions[s].max;
      }
    return attributes;
  }

  crewWideModifiers = ['lay_of_the_land', 'telepathy'];
  // Store the ID of each user who owns the crew-wide abilities if they're needed
  async updateCrewWideAbilityOwnership(actor) {
    if (!actor) actor = this;
    let modifiersCollection = { modifiers: actor.system.modifiers, roll_modifiers: actor.system.roll_modifiers, conditional_roll_modifiers: actor.system.conditional_roll_modifiers };

    let squadFull = BladesHelpers.resolveActor(actor.system.crew);
    if (!squadFull) {
      let updateObject = {system: {}};
      for (let modifier of this.crewWideModifiers)
        updateObject[`system.${modifier}_owners`] = null;
      await BladesHelpers.tryUpdate(actor, updateObject);
    }
    if (actor.type == 'character' && squadFull) {
      let characterLists = {};
      for (let modifier of this.crewWideModifiers)
        characterLists[modifier] = [];

      // Fetch character modifiers applying to the whole crew
      for (let characterUuid of Object.values(squadFull.system.members).map(e => e.uuid)) {
        if (characterUuid == actor.uuid) continue;

        let characterFull = BladesHelpers.resolveActor(characterUuid);
        if (!characterFull || characterFull.type != 'character') continue;
        for (let modifierPath of Object.keys(modifiersCollection)) {
          let characterCrewWideModifiers = Object.fromEntries(Object.entries(characterFull.system[modifierPath]).filter(([k, _]) => this.crewWideModifiers.includes(k)));
          Object.assign(modifiersCollection[modifierPath], characterCrewWideModifiers);
          for (let modifier of Object.keys(characterCrewWideModifiers))
            if (!characterLists[modifier].includes(characterFull.uuid))
              characterLists[modifier].push(characterFull.uuid);
        }
      }

      // Store the name of all members of the team who owns crew-wide abilities
      for (let [modifier, owners] of Object.entries(characterLists)) {
        if (owners.toString() == actor.system[`${modifier}_owners`]?.toString())
          continue;
        let updateObject = {};
        updateObject[`system.==${modifier}_owners`] = owners;
        await BladesHelpers.tryUpdate(actor, updateObject);
      }
    }
  }

  getModifiers(actor) {
    if (!actor) actor = this;
    let modifiersCollection = { modifiers: actor.system.modifiers, roll_modifiers: actor.system.roll_modifiers, conditional_roll_modifiers: actor.system.conditional_roll_modifiers };

    let squadFull = BladesHelpers.resolveActor(actor.system.crew);
    if (squadFull) {
      // Fetch crew-level modifiers applying to the object
      for (let modifierPath of Object.keys(modifiersCollection))
        if (squadFull?.system[modifierPath][actor.type] !== undefined)
          modifiersCollection[modifierPath] = BladesHelpers.mergeAddObjects(modifiersCollection[modifierPath], ['cohort', 'character'], squadFull.system[modifierPath][actor.type]);

      if (['crew', 'cohort'].includes(actor.type))
        // Fetch character modifiers
        for (let characterUuid of Object.values(squadFull.system.members).map(e => e.uuid)) {
          let characterFull = BladesHelpers.resolveActor(characterUuid);
          if (characterFull.type != 'character') continue;
          for (let modifierPath of Object.keys(modifiersCollection))
            if (characterFull.system[modifierPath][actor.type])
              for (let [modifierName, modifierValue] of Object.entries(characterFull.system[modifierPath][actor.type]))
                actor.system[modifierPath][modifierName] = modifierValue;
        }
    }

    return [modifiersCollection.modifiers, modifiersCollection.roll_modifiers, modifiersCollection.conditional_roll_modifiers];
  }

  applyModifiers(sheetData) {
    // Catch unmigrated actor data and apply the Mastery crew ability to attribute maxes
    sheetData.system.attributes = this.getComputedAttributes(sheetData.system.modifiers?.mastery);

    // Apply all stat changes
    sheetData.system = BladesHelpers.mergeAddObjects(sheetData.system, ['crew'], sheetData.system.modifiers);

    // Sanitize some data (make sure it's kept within its normal bounds)
    sheetData.system.load = Math.max(sheetData.system.load, 0);

    // Check for healing minimums
    sheetData.system.healing_clock.value = Math.max(parseInt(sheetData.system.healing_clock.value), sheetData.system.healing_clock.min);
  }

  /* -------------------------------------------- */

  async createGroupAction(action, position, forcedPosition, effect, forcedEffect, leaderFull, note) {
    let diceAmount = leaderFull.getRollData().diceAmount[action];

    // Leader: Increase effect by 1 level
    let leaderHasLeaderAbility = leaderFull.items.filter(i => i.system.leader).length > 0;
    let numberedEffect = effectIndex.indexOf(effect) + (leaderHasLeaderAbility ? 1 : 0);
    effect = effectIndex[Math.min(Math.max(numberedEffect, 0), 2)];

    this.system.group_action = { action: action, position: position, forcedPosition: forcedPosition, effect: effect, forcedEffect: forcedEffect, leader: leaderFull.uuid, leader_action: diceAmount, note: note, rolls: {} };
    await BladesHelpers.tryUpdate(this, {'system.==group_action': this.system.group_action});
  }

  async updateGroupActionRoll(actorId, roll) {
    this.system.group_action.rolls[actorId] = roll;
    await BladesHelpers.tryUpdate(this, {'system.group_action.==rolls': this.system.group_action.rolls});
  }

  async revealGroupActionResult() {
    if (!this.system.group_action) {
      ui.notifications.error(game.i18n.localize('BITD.log.error.NoGroupAction'));
      return;
    }
    computeGroupActionResultAndSendMessage(this.system.group_action, this);
  }

  /* -------------------------------------------- */

  async handleVendetta() {
    let inVendetta = BladesHelpers.fetchAllRelationships(this).filter(r => r.status == -3).map(r => BladesHelpers.resolveActor(r.owner)).filter(r => r != null).length > 0;
    inVendetta &&= this.items.find(i => i.system.war_dogs) == null;
    if (inVendetta != this.system.vendetta) {
      let updateObject = {'system.vendetta': inVendetta};
      let squadStrength = 2 * Number(this.system.tier.value) + (this.system.hold == 'strong' ? 1 : 0);
      squadStrength = Math.max(Math.min(squadStrength + (inVendetta ? -1 : 1), 8), 0);
      squadStrength = squadStrength;
      updateObject['system.tier.value'] = Math.floor(squadStrength / 2);
      updateObject['system.hold'] = squadStrength % 2 == 1 ? 'strong' : 'weak';
      await BladesHelpers.tryUpdate(this, updateObject);
      for (let cohort of this.items.filter(i => i.type == 'cohort'))
        await cohort.updateCohortQualityScale();
    }
  }

  /* -------------------------------------------- */

  hasValidVehicle() {
    if (this.system.vehicle) {
      let vehicleFull = BladesHelpers.resolveActor(this.system.vehicle);
      if (vehicleFull)
        return true;
    }
    return false;
  }

  getVehicleData(path) {
    if (!this.hasValidVehicle()) return undefined;
    let data = BladesHelpers.resolveActor(this.system.vehicle);
    for (let pathPart of path.split('.')) {
      if (typeof data !== 'object' || Array.isArray(data) || data == null)
        return data;
      data = data[pathPart];
    }
    return data;
  }

  getItemOwner(item, onlyId) {
    let pilotFull = this.system.pilot ? BladesHelpers.resolveActor(this.system.pilot) : null;
    if (typeof item == 'string')
      item = {_id: item};

    return this.selectItemOwner(pilotFull, item, onlyId);
  }

  selectItemOwner(pilotFull, item, onlyId) {
    let result = null;
    let itemResult = null;
    let thisItemResult = this.items.find(i => i._id == item._id);
    let pilotItemResult = pilotFull?.items.find(i => i._id == item._id);
    if (thisItemResult) {
      result = this;
      itemResult = thisItemResult;
    }
    if (pilotItemResult) {
      result = pilotFull;
      itemResult = pilotItemResult;
    }

    if (onlyId && result) {
      result = result.uuid;
      itemResult = itemResult._id;
    }
    return [result, itemResult];
  }

  getGeneralVehicleGearOwner(onlyId) {
    let result = this.system.pilot ? BladesHelpers.resolveActor(this.system.pilot) : this;
    if (onlyId && result)
      result = result.uuid;
    return result;
  }

  async updateVehicleForm() {
    let more_than_meets_the_eye = false;
    let gearOwner = this.getGeneralVehicleGearOwner();
    if (gearOwner != this)
      more_than_meets_the_eye = gearOwner.system.more_than_meets_the_eye;

    for (let gear of gearOwner.items.filter(e => e.type == 'vehicle_gear')) {
      let suppressed = false;
      if (gear.system.form > 0) {
        if (gear.system.form == 1 && this.system.is_second_form == true) suppressed = true;
        else if (gear.system.form == 2 && this.system.is_second_form == false) suppressed = true;
      }
      if (gear.system.owner) {
        let container = gearOwner.items.find(i => i._id == gear.system.owner);
        if (container.system.suppressed) suppressed = true;
      }

      if (gear.system.suppressed != suppressed) {
        await BladesHelpers.tryUpdate(gear, {'system.suppressed': suppressed});
        if (suppressed)
          await BladesHelpers.preDeleteItem(gear, gearOwner, false);
        else
          await BladesHelpers.postCreateItem(gear, gearOwner);
      }
    }
  }

  /* -------------------------------------------- */

  async removeItem(item) {
    const [owner, _] = this.getItemOwner(item);
    await BladesHelpers.preDeleteItem(item, this);
    const itemCopy = foundry.utils.deepClone(item);
    await BladesHelpers.tryDelete(item, this);
    await BladesHelpers.postDeleteItem(itemCopy, this);
  }
}