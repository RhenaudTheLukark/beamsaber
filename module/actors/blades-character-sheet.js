import { BladesSheet } from '../blades-sheet.js';
import { BladesActiveEffect } from '../blades-active-effect.js';
import { BladesHelpers } from '../blades-helpers.js';
import { bladesRoll, simpleRollPopup, buildRollPopup, resolveRollModifierArray, resolveConditionalModifiers,
  checkDowntimeRules, dialogOnFirstRender, dialogOnRender, refreshModifiers, postRollProcessing,
  pruneInvalidConditionalRollModifiers, keepValidModifiersFromOther } from '../blades-roll.js';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {BladesSheet}
 */
export class BladesCharacterSheet extends BladesSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['beamsaber', 'sheet', 'actor', 'character'],
      template: 'systems/beamsaber/templates/actors/character-sheet.html',
      width: 790,
      height: 890,
      tabs: [{ navSelector: '.tabs', contentSelector: '.tab-content', initial: 'abilities' }]
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
    sheetData.effects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);;

    // Calculate Load
    sheetData.system.load = BladesHelpers.computeLoad(sheetData, false);

    // Fetch crew, vehicle & region data
    sheetData.system.crew = BladesHelpers.resolveActor(sheetData.system.crew, { name: 'Unknown Squad' });
    sheetData.system.vehicle = BladesHelpers.resolveActor(sheetData.system.vehicle, { name: 'Unknown Vehicle' });
    sheetData.system.region = BladesHelpers.resolveActor(sheetData.system.region, { name: 'Unknown Region' });

    sheetData.system.class = BladesHelpers.getOwnedItem(this.actor, sheetData.system.class);

    // Get all connection actors
    for (let connection of Object.values(sheetData.system.connections))
      connection.actor = BladesHelpers.resolveActor(connection.uuid, { name: 'Unknown Connection' });
    sheetData.system.resolved_connections = Object.values(sheetData.system.connections);

    // Calculate Vehicle Load
    if (sheetData.system.vehicle && sheetData.system.vehicle.system)
      sheetData.system.vehicle.system.load = BladesHelpers.computeLoad(sheetData.system.vehicle, true);

    // Get all sheet value modifiers
    [sheetData.system.modifiers, sheetData.system.roll_modifiers, sheetData.system.conditional_roll_modifiers] = this.actor.getModifiers();
    this.actor.applyModifiers(sheetData);

    // Extra data used in the sheet
    sheetData.hasActiveAdvancedPrototype = sheetData.items.find(i => i.system.experimental == true) !== undefined;
    sheetData.hasActiveHiddenItem = sheetData.items.find(i => i.system.hidden == true) !== undefined;

    // Encumbrance levels
    let load_level;
    let mule_level;
    if (game.settings.get('beamsaber', 'DeepCutLoad')) {
      load_level = ['BITD.Discreet', 'BITD.Discreet', 'BITD.Discreet', 'BITD.Discreet', 'BITD.Discreet', 'BITD.Conspicuous', 'BITD.Conspicuous', 'BITD.Encumbered',
        'BITD.Encumbered', 'BITD.Encumbered', 'BITD.OverMax', 'BITD.OverMax'];
      mule_level = ['BITD.Discreet', 'BITD.Discreet', 'BITD.Discreet', 'BITD.Discreet', 'BITD.Discreet', 'BITD.Discreet', 'BITD.Discreet', 'BITD.Conspicuous',
        'BITD.Conspicuous', 'BITD.Encumbered', 'BITD.Encumbered', 'BITD.OverMax'];
    } else {
      load_level = ['BITD.Light', 'BITD.Light', 'BITD.Light', 'BITD.Light', 'BITD.Normal', 'BITD.Normal', 'BITD.Heavy', 'BITD.Encumbered',
        'BITD.Encumbered', 'BITD.Encumbered', 'BITD.OverMax', 'BITD.OverMax'];
      mule_level = ['BITD.Light', 'BITD.Light', 'BITD.Light', 'BITD.Light', 'BITD.Light', 'BITD.Light', 'BITD.Normal', 'BITD.Normal',
        'BITD.Heavy', 'BITD.Encumbered', 'BITD.OverMax', 'BITD.OverMax'];
    }

    // Set encumbrance level
    sheetData.system.load_level = sheetData.system.mule ? mule_level[sheetData.system.load] : load_level[sheetData.system.load];
    if (sheetData.system.vehicle && sheetData.system.vehicle.system)
      sheetData.system.vehicle.system.load_level = load_level[sheetData.system.vehicle.system.load];

    if (game.settings.get('beamsaber', 'DeepCutLoad')) {
      sheetData.system.load_levels = { 'BITD.Discreet': 'BITD.Discreet', 'BITD.Conspicuous': 'BITD.Conspicuous' };
    } else {
      sheetData.system.load_levels = {
        'BITD.Light': 'BITD.Light',
        'BITD.Normal': 'BITD.Normal',
        'BITD.Heavy': 'BITD.Heavy'
      };
    }

    let idToNumber = {
      1: 'one',
      2: 'two',
      3: 'three',
      4: 'four',
      5: 'five',
      6: 'six',
      7: 'seven',
      8: 'eight',
    }
    sheetData.traumaList = {};
    for (let [id, traumaId] of Object.entries(idToNumber)) {
      if (id > sheetData.system.trauma.max)
        break;
      sheetData.traumaList[id] = {id: id, traumaId: traumaId, value: sheetData.system.trauma.values[traumaId]};
    }

    /*sheetData.system.description = await foundry.applications.ux.TextEditor.enrichHTML(sheetData.system.description, {
      secrets: sheetData.owner,
      async: true
    });*/

    sheetData.defaultClockThemeColor = game.settings.get('beamsaber', 'DefaultClockThemeColor');

    sheetData.specialAmmunitionDropdown = {
      'flak': 'BITD.AmmoTypeFlak',
      'armor_piercing': 'BITD.AmmoTypeArmorPiercing',
      'incendiary': 'BITD.AmmoTypeIncendiary',
      'other': 'BITD.AmmoTypeOther',
    }

    sheetData.hackrigTypeDropdown = {
      'tablet': 'BITD.HackrigTypeTablet',
      'laptop': 'BITD.HackrigTypeLaptop',
      'tower': 'BITD.HackrigTypeTower',
      'other': 'BITD.HackrigTypeOther'
    }

    sheetData.droneTypeDropdown = {
      'pilot': 'BITD.Pilot',
      'vehicle': 'BITD.VehicleName'
    }

    sheetData.expertiseDropdown = {'': 'None'};
    for (let action of BladesHelpers.getAllActions())
      sheetData.expertiseDropdown[action] = BladesHelpers.getAttributeLabel(action);

    sheetData.gearOwner = sheetData;

    // Update container loads
    for (let container of sheetData.items.filter(i => i.system.is_container)) {
      let [owner, _] = this.actor.getItemOwner(container);
      container.system.container_computed_load = BladesHelpers.computeMaxLoad(owner, container);
      container.system.current_load = BladesHelpers.computeLoad(owner, false, container._id);
      container.system.container_item_types_str = container.system.container_item_types.join(',');
    }

    return sheetData;
  }

  /** @override */
  async _onDropItem(event, droppedItem) {
    await super._onDropItem(event, droppedItem);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedItem);
  }

  /** @override */
  async _onDropActor(event, droppedActor) {
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
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
    for (let droppedEntityFull of droppedEntitiesFull) {
      if (!droppedEntityFull || droppedEntityFull.uuid == this.actor.uuid)
        continue;

      switch (droppedEntityFull.type) {
        case 'crew':
          await BladesHelpers.addSquadCharacter(droppedEntityFull, this.actor, false);
          break;
        case 'region':
          await BladesHelpers.addCharacterRegion(this.actor, droppedEntityFull, true);
          break;
        case 'character':
        case 'npc':
          await BladesHelpers.addCharacterConnection(this.actor, droppedEntityFull, true);
          break;
        case 'vehicle':
          await BladesHelpers.addCharacterVehicle(this.actor, droppedEntityFull, true);
          break;
        case 'class':
          await this.addItemAsObjectAndStoreReference(droppedEntityFull, 'system.class');
          break;
        default:
          break;
      }
    }
  }

  /* -------------------------------------------- */

  async _onSparkToggleLeftClick(event) {
    if (event.target.checked)
      await BladesHelpers.tryUpdate(this.actor, {'system.spark': true});
    else
      await this.sparkUsagePopup();
  }

  async _onSparkToggleRightClick(event) {
    await BladesHelpers.tryUpdate(this.actor, {'system.spark': !event.target.checked});
  }

  /**
   * Call a popup for using spark.
   */
  async sparkUsagePopup() {
    let sparkOptions = '';
    for (let sparkOption of this.actor.system.spark_options) {
      let optionText = game.i18n.localize(sparkOption);
      sparkOptions += `
      <div class="radio-group">
        <label>
          <input type="radio" id="${optionText[0].toLowerCase() + optionText.slice(1)}" name="sparkOption" ${sparkOptions.length == 0 ? 'checked' : ''}> ${optionText}
        </label>
      </div>`;
    }

    if (!sparkOptions) {
      ui.notifications.warn(game.i18n.localize('BITD.log.warn.NoSparkOptions'));
      return;
    }

    let contents = `
      <h2>${game.i18n.localize('BITD.UseSpark')}</h2>
      <form>
        <fieldset class="form-group spark-options">
          <legend>${game.i18n.localize('BITD.SparkUsageOptions')}</legend>
          ${sparkOptions}
        </fieldset>
        <div class="form-group">
          <label>${game.i18n.localize('BITD.Notes')}:</label>
          <input id="note" name="note" type="text" value="">
        </div>
      </form>`;

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('BITD.UseSpark')}` },
      content: contents,
      buttons: [
        {
          icon: 'fas fa-burst',
          label: game.i18n.localize('BITD.UseSpark'),
          action: 'use',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'use') return;

        let html = $(dialog.element);
        let input = html.find('input[type=radio]:checked');
        let note = html.find('[name="note"]')[0].value;
        if (input.length > 0) {
          let contents = input[0].id;
          let speaker = {
            actor: this.actor._id,
            alias: this.actor.name,
            scene: null,
            token: this.actor.prototypeToken._id
          };
          let messageData = {
            speaker: speaker,
            content: await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/spark-usage.html', { contents: contents, note: note })
          }
          ChatMessage.create(messageData);

          await BladesHelpers.tryUpdate(this.actor, {'system.spark': false});
        }
      }
    });
    dialog.render(true);
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html.find('.spark').click((e) => {
      e.preventDefault();
      this._onSparkToggleLeftClick(e);
    });
    html.find('.spark').contextmenu((e) => { this._onSparkToggleRightClick(e); });

    // Delete Character's Class
    html.find('.delete-class').click(async ev => {
      let element = $(ev.currentTarget).closest('.item');
      let item = this.actor.items.get(element.data('itemId'));
      if (element.parent().hasClass('item-with-container'))
        element = element.parent();
      element.slideUp(200, async () => {
        await this.actor.removeItem(item);
        await BladesHelpers.tryUpdate(this.actor, {'system.class': null});
      });
    });

    // Remove Squad from character sheet
    html.find('.delete-crew').click(async ev => {
      await BladesHelpers.removeSquadCharacter(this.actor);
    });

    // Remove Vehicle from character sheet
    html.find('.delete-vehicle').click(async ev => {
      await BladesHelpers.removeCharacterVehicle(this.actor);
    });

    // Remove Region from character sheet
    html.find('.delete-region').click(async ev => {
      await BladesHelpers.removeCharacterRegion(this.actor);
    });

    // Update Scar Count
    html.find('.trauma-list input').change(async ev => {
      let count = Object.values(this.actor.system.trauma.values).filter(s => s != '').length;
      let currentInput = ev.currentTarget.attributes.name.value.split('.').reverse()[0];
      let oldValue = this.actor.system.trauma.values[currentInput];
      if (oldValue != '' && ev.currentTarget.value == '') count--;
      if (oldValue == '' && ev.currentTarget.value != '') count++;
      await BladesHelpers.tryUpdate(this.actor, {'system.trauma.value': count});
    });

    // Delete Connection
    html.find('.delete-connection').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentConnectionId = element.data('connectionId');
      let connectionsEntries = Object.entries(this.actor.system.connections);
      connectionsEntries.splice(currentConnectionId, 1);
      for (let id in connectionsEntries)
        connectionsEntries[id][0] = String(id);
      await BladesHelpers.tryUpdate(this.actor, {'system.==connections': Object.fromEntries(connectionsEntries)});
    });

    // Add Quirk
    html.find('.add-quirk').click(async _ => {
      if (!this.actor.system.vehicle) return;
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      if (!vehicleFull) return;
      let quirks = vehicleFull.system.quirks;
      quirks[Object.keys(quirks).length] = { name: '', usable: true };
      await BladesHelpers.tryUpdate(vehicleFull, {'system.==quirks': quirks});
      await this.actor.sheet.render(true);
    });

    // Delete Quirk
    html.find('.delete-quirk').click(async ev => {
      if (!this.actor.system.vehicle) return;
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      if (!vehicleFull) return;
      const element = $(ev.currentTarget).closest('.item');
      let currentQuirkId = element.data('quirkId');
      let quirksEntries = Object.entries(vehicleFull.system.quirks);
      quirksEntries.splice(currentQuirkId, 1);
      for (let id in quirksEntries)
        quirksEntries[id][0] = String(id);
      await BladesHelpers.tryUpdate(vehicleFull, {'system.==quirks': Object.fromEntries(quirksEntries)});
      await this.actor.sheet.render(true);
    });

    // Update Expertise Action
    html.find('.expertise > select').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      const selectedAction = ev.currentTarget.value;
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.expertise_action': selectedAction});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Stay Late Popup
    html.find('.stay-late > button').click(async ev => {
      let squadFull = BladesHelpers.resolveActor(this.actor.system.crew);
      if (!squadFull) {
        ui.notifications.warn(game.i18n.localize('BITD.log.warn.StayLateNoSquad'));
        return;
      }

      let otherMembers = Object.values(squadFull.system.members).filter(m => m.uuid != this.actor.uuid).map(m => BladesHelpers.resolveActor(m.uuid)).filter(m => m != null && m.type == 'character');

      let contents = `
        <h2>${game.i18n.localize('BITD.StayLate')}</h2>
        <p>${game.i18n.localize('BITD.StayLateInfo')}</p>
        <table class="form-group" data-actor-id="${this.actor.uuid}">
          ${otherMembers.map((member, i) => `${i % 2 == 0 ? '<tr>' : ''}<td class="actor-cell flex-equal" data-actor-id="${member.uuid}">
            <div class="actor-contents flex-horizontal">
              <img src="${member.img}" data-tooltip="${member.name}" width="48" height="48"/>
              <a class="item-name">${member.name}</a>
            </div>
          </td>${(i % 2 == 1 || i == otherMembers.length - 1) ? '</tr>' : ''}`).join('')}
        </table>`;

      let dialog = new foundry.applications.api.DialogV2({
        window: { title: `${game.i18n.localize('BITD.StayLate')}` },
        content: contents,
        classes: ['stay-late'],
        buttons: [
          {
            icon: 'fas fa-clock',
            label: game.i18n.localize('BITD.Use'),
            action: 'use',
            disabled: true
          },
          {
            icon: 'fas fa-times',
            label: game.i18n.localize('Cancel'),
            action: 'cancel'
          }
        ],
        submit: async (result, dialog) => {
          if (result != 'use') return;

          let targetFull = BladesHelpers.resolveActor(dialog.element.querySelector('.selected').dataset.actorId);
          let actorFull = BladesHelpers.resolveActor(dialog.element.querySelector('.form-group').dataset.actorId);
          if (!targetFull || !actorFull) return;

          await BladesHelpers.tryUpdate(targetFull, {'system.downtime_count.value': targetFull.system.downtime_count.value + 1});

          let speaker = {
            actor: this.actor._id,
            alias: this.actor.name,
            scene: null,
            token: this.actor.prototypeToken._id
          };
          let messageHTML = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/stay-late.html', { actor: actorFull.name, target: targetFull.name });
          let messageData = {
            speaker: speaker,
            content: messageHTML
          }
          ChatMessage.create(messageData);
        }
      });
      dialog._value = null;
      dialog.actor = this.actor;
      await dialog.render(true);

      for (let element of dialog.element.querySelectorAll('.actor-cell')) {
        element.addEventListener('click', async function(ev) {
          ev.preventDefault();
          let previousSelected = ev.currentTarget.closest('.form-group').querySelector('.selected');
          if (previousSelected)
            previousSelected.classList.remove('selected');
          ev.currentTarget.classList.add('selected');
          ev.currentTarget.closest('.stay-late').querySelector('[data-action="use"]').disabled = false;
        });
      }
    });

    // Carry That Weight Popup
    html.find('.carry-that-weight > button').click(async ev => {
      let squadFull = BladesHelpers.resolveActor(this.actor.system.crew);
      if (!squadFull) {
        ui.notifications.warn(game.i18n.localize('BITD.log.warn.CarryThatWeightNoSquad'));
        return;
      }

      let otherMembers = Object.values(squadFull.system.members).filter(m => m.uuid != this.actor.uuid).map(m => BladesHelpers.resolveActor(m.uuid)).filter(m => m != null && m.type == 'character');
      let stressToMax = Number(this.actor.system.stress.max) - (this.actor.system.stress.value);

      let contents = `
        <h2>${game.i18n.localize('BITD.CarryThatWeight')}</h2>
        <p>${game.i18n.localize('BITD.CarryThatWeightInfo')}</p>
        <table class="form-group" data-actor-id="${this.actor.uuid}">
          ${otherMembers.map((member, i) => `${i % 2 == 0 ? '<tr>' : ''}<td class="actor-cell flex-equal" data-actor-id="${member.uuid}">
            <div class="actor-contents flex-horizontal">
              <img src="${member.img}" data-tooltip="${member.name}" width="48" height="48"/>
              <a class="item-name">${member.name}</a>
            </div>
          </td>${(i % 2 == 1 || i == otherMembers.length - 1) ? '</tr>' : ''}`).join('')}
        </table>
        <div class="stress-transfer flex-horizontal" style="display: none;">
          <div class="actor-stress flex-vertical flex-equal">
            <label>${this.actor.name}</label>
            <label class="stress">${this.actor.system.stress.value}/${this.actor.system.stress.max}</label>
          </div>
          <div class="selector flex-vertical">
            <label>Stress Transfer</label>
            <select id="stress-transfer" data-actor-stress-to-max="${stressToMax}" data-actor-max-stress="${this.actor.system.stress.max}">${Array(stressToMax + 1).fill().map((_, i) => `<option value="${i}"${i == 0 ? ' selected' : ''}>${i}</option>`)}</select>
          </div>
          <div class="other-stress flex-vertical flex-equal">
            <label class="name">Other</label>
            <label class="stress">Value/Max</label>
          </div>
        </div>`;

      let dialog = new foundry.applications.api.DialogV2({
        window: { title: `${game.i18n.localize('BITD.CarryThatWeight')}` },
        content: contents,
        classes: ['carry-that-weight'],
        buttons: [
          {
            icon: 'fas fa-people-arrows',
            label: game.i18n.localize('BITD.Use'),
            action: 'use',
            disabled: true
          },
          {
            icon: 'fas fa-times',
            label: game.i18n.localize('Cancel'),
            action: 'cancel'
          }
        ],
        submit: async (result, dialog) => {
          if (result != 'use') return;

          let targetFull = BladesHelpers.resolveActor(dialog.element.querySelector('.selected').dataset.actorId);
          let actorFull = BladesHelpers.resolveActor(dialog.element.querySelector('.form-group').dataset.actorId);
          if (!targetFull || !actorFull) return;

          let stressTransferred = Number(dialog.element.querySelector('#stress-transfer').value);
          await BladesHelpers.tryUpdate(actorFull, {'system.stress.value': Number(actorFull.system.stress.value) + stressTransferred});
          await BladesHelpers.tryUpdate(targetFull, {'system.stress.value': Number(targetFull.system.stress.value) - stressTransferred});

          let speaker = {
            actor: this.actor._id,
            alias: this.actor.name,
            scene: null,
            token: this.actor.prototypeToken._id
          };
          let messageHTML = await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/chat/carry-that-weight.html', { actor: actorFull.name, target: targetFull.name, stress: stressTransferred });
          let messageData = {
            speaker: speaker,
            content: messageHTML
          }
          ChatMessage.create(messageData);
        }
      });
      dialog._value = null;
      dialog.actor = this.actor;
      dialog.updateStressValues = function(element) {
        let currentValue = Number(element.value);
        element.closest('.carry-that-weight').querySelector('[data-action="use"]').disabled = currentValue == 0;

        let actorMaxStress = Number(element.dataset.actorMaxStress);
        let actorStress = actorMaxStress - Number(element.dataset.actorStressToMax);
        let actorNewStress = actorStress + currentValue;
        let actorStressText = `${actorStress}/${actorMaxStress}${currentValue > 0 ? ` => ${actorNewStress}/${actorMaxStress}` : ''}`;
        let otherMaxStress = Number(element.dataset.otherMaxStress);
        let otherStress = otherMaxStress - Number(element.dataset.otherStressToMax);
        let otherNewStress = otherStress - currentValue;
        let otherStressText = `${otherStress}/${otherMaxStress}${currentValue > 0 ? ` => ${otherNewStress}/${otherMaxStress}` : ''}`;

        let actorStressTextElement = element.closest('.stress-transfer').querySelector('.actor-stress .stress');
        actorStressTextElement.innerHTML = actorStressText;
        let actorNewStressMaxxed = actorNewStress == actorMaxStress;
        if (actorNewStressMaxxed && !actorStressTextElement.classList.contains('maxxed'))
          actorStressTextElement.classList.add('maxxed');
        else if (!actorNewStressMaxxed && actorStressTextElement.classList.contains('maxxed'))
          actorStressTextElement.classList.remove('maxxed');

        let otherStressTextElement = element.closest('.stress-transfer').querySelector('.other-stress .stress');
        otherStressTextElement.innerHTML = otherStressText;
        let otherNewStressMaxxed = otherNewStress == otherMaxStress;
        if (otherNewStressMaxxed && !otherStressTextElement.classList.contains('maxxed'))
          otherStressTextElement.classList.add('maxxed');
        else if (!otherNewStressMaxxed && otherStressTextElement.classList.contains('maxxed'))
          otherStressTextElement.classList.remove('maxxed');
      }
      await dialog.render(true);

      for (let element of dialog.element.querySelectorAll('.actor-cell')) {
        element.addEventListener('click', async function(ev) {
          let previousSelected = ev.currentTarget.closest('.form-group').querySelector('.selected');
          if (previousSelected)
            previousSelected.classList.remove('selected');
          ev.currentTarget.classList.add('selected');

          let otherFull = BladesHelpers.resolveActor(ev.currentTarget.dataset.actorId);
          let otherMaxStress = 0, otherStress = 0;
          if (otherFull) {
            otherMaxStress = Number(otherFull.system.stress.max);
            otherStress = Number(otherFull.system.stress.value);
          }
          let otherStressNameElement = ev.currentTarget.closest('.carry-that-weight').querySelector('.other-stress .name');
          otherStressNameElement.innerText = otherFull.name;

          let stressTransferElement = element.closest('.carry-that-weight').querySelector('#stress-transfer');
          let actorStressToMax = Number(stressTransferElement.dataset.actorStressToMax);
          stressTransferElement.dataset.otherMaxStress = otherMaxStress;
          stressTransferElement.dataset.otherStressToMax = otherMaxStress - otherStress;
          stressTransferElement.innerHTML = Array(Math.min(actorStressToMax, otherStress) + 1).fill().map((_, i) => `<option value="${i}"${i == 0 ? ' selected' : ''}>${i}</option>`);
          stressTransferElement.value = '0';

          let stressTransferBlockElement = ev.currentTarget.closest('.carry-that-weight').querySelector('.stress-transfer');
          stressTransferBlockElement.style.display = '';

          dialog.updateStressValues(stressTransferElement);
        });
      }
      dialog.element.querySelector('#stress-transfer').addEventListener('change', async function(ev) {
        dialog.updateStressValues(ev.currentTarget);
      });
    });

    // Update Vehicle Gear Experimental Toggle
    html.find('.experimental > input').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.experimental': ev.currentTarget.checked});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Items' Hidden Toggle
    html.find('.hidden-item > input').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.hidden': ev.currentTarget.checked});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Item Uses
    html.find('.uses > input').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.uses.value': ev.currentTarget.value});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Item Description
    html.find('.extra-description > textarea').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.extra_description': ev.currentTarget.value});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Hackrig Type
    html.find('.hackrig-type > select').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      let item = this.actor.items.get(currentItemId);
      let newHackrigType = ev.currentTarget.value;
      let hackrigLoad = newHackrigType == 'tablet' ? 3 : newHackrigType == 'laptop' ? 5 : newHackrigType == 'tower' ? 6 : item.system.container_load;
      await BladesHelpers.tryUpdate(item, {'system.container_type': newHackrigType, 'system.container_load': hackrigLoad});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Special Ammunition
    html.find('.ammo > select').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      const selectedAmmo = ev.currentTarget.value;
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.special_ammunition_type': selectedAmmo});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Drone Item Type
    html.find('.drone-type > select').change(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      let item = this.actor.items.get(currentItemId);
      let newDroneItemType = ev.currentTarget.value;
      if (newDroneItemType != item.system.container_type)
        for (let containedItem of this.actor.items.filter(i => i.system.owner == currentItemId))
          await this.actor.removeItem(containedItem);
      let newContainerItemType = newDroneItemType == 'pilot' ? 'item' : 'vehicle_gear';
      let newContainerLoad = newDroneItemType == 'pilot' ? 2 : 1;
      await BladesHelpers.tryUpdate(item, {'system.container_type': newDroneItemType, 'system.container_load': newContainerLoad, 'system.==container_item_types': [newContainerItemType]});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Vehicle Gear Form
    html.find('.form-toggle > button').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.form': (item.system.form + 1) % 3});
      if (!this.actor.system.vehicle) return;
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      if (vehicleFull)
        vehicleFull.updateVehicleForm();
    });

    // Collapse item containers
    html.find('.collapse').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      let currentItemId = element.data('itemId');
      let item = this.actor.items.get(currentItemId);
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      let childrenElement = $(element[0].parentElement).children('.item-container');
      childrenElement.slideToggle(200, async () => {
        await BladesHelpers.tryUpdate(item, {'system.collapsed': !item.system.collapsed});
        if (vehicleFull)
          await vehicleFull.sheet.render(true);
      });
    });

    const vehicleDataHandler = async ev => {
      const element = $(ev.currentTarget);
      let path = element.data('name');
      let value = ev.currentTarget.type == 'checkbox' ? ev.currentTarget.checked : ev.currentTarget.value;
      if (!this.actor.system.vehicle) return;
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      if (!vehicleFull) return;

      // Attributes: Remove the minimum value from the pilot
      let pathSteps = path.split('.');
      if (path.includes('.actions.')) {
        let container = this.actor;
        for (let [depth, field] of Object.entries(pathSteps)) {
          if (depth < pathSteps.length - 1)
            container = container[field];
          else
            value -= container.min;
        }
      }

      let updateObject = BladesHelpers.createUpdateObjectFromPath(value, path);
      await BladesHelpers.tryUpdate(vehicleFull, updateObject);
      await this.actor.sheet.render(true);
    };

    // Update Any Vehicle Data
    html.find('input[type=radio].vehicle-data, input[type=checkbox].vehicle-data').click(vehicleDataHandler);
    html.find('select.vehicle-data, input[type=text].vehicle-data').change(vehicleDataHandler);

    html.find('.other-rolls').click(async (e) => {
      await simpleRollPopup('BITD.OtherRoll', 'BITD.OtherRollFull', this.actor, false);
    });

    // Downtime Roll Menu
    html.find('.downtime').click(async (e) => {
      // Fetch roll modifiers
      let [_, allPermanentModifiers, allConditionalModifiers] = this.actor.getModifiers();
      allPermanentModifiers = await resolveRollModifierArray(allPermanentModifiers, this.actor);
      allConditionalModifiers = await resolveRollModifierArray(allConditionalModifiers, this.actor);
      allConditionalModifiers = pruneInvalidConditionalRollModifiers(this.actor, allConditionalModifiers);

      let title = game.i18n.localize('BITD.DowntimeActivity');
      let [rollTypes, missingRollTypes] = this.getDowntimeRollTypesToRemove();

      let dialog = new foundry.applications.api.DialogV2({
        window: { title: title },
        content: buildRollPopup(title, this.actor, rollTypes, missingRollTypes),
        buttons: [
          {
            icon: 'fas fa-check',
            label: `${game.i18n.localize('BITD.Roll')} (${game.i18n.format('BITD.DowntimeRollLeft', {num: Math.max(this.actor.system.downtime_count.value, 0)})})`,
            action: 'roll'
          },
          {
            icon: 'fas fa-times',
            label: game.i18n.localize('Close'),
            action: 'close'
          },
        ],
        submit: async (result, dialog) => {
          if (result != 'roll') return;

          let html = $(dialog.element);
          let extraDice = parseInt(html.find('[name="mod"]')[0].value);
          let note = html.find('[name="note"]')[0].value;

          // Fetch enabled conditional roll modifiers by HTML inspection
          let enabledConditionalModifiers = resolveConditionalModifiers(dialog, this.actor);
          enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);

          let input = html.find('input[type=radio]:checked');
          if (input.length > 0) {
            let rollType = input[0].id.split('-')[0];
            let extraFields = { roll_type: rollType, modifiers: [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ], actor: this.actor };
            let squadFull = BladesHelpers.resolveActor(this.actor.system.crew);
            switch (rollType) {
              case 'acquireAsset':
                let acquireAssetSuccessTier = html.find('[name="acquireAssetSuccessTier"]')[0].value;
                let acquireAssetDiceAmount = Number(squadFull.system.tier.value) + extraDice;
                extraFields.tier = Number(squadFull.system.tier.value);
                extraFields.successTier = acquireAssetSuccessTier;
                await bladesRoll(acquireAssetDiceAmount, 'BITD.AcquireAssetRoll', note, extraFields);
                break;
              case 'collect':
                let collectRegionUuid = html.find('#collectRegion > .actor-contents').data('actorId');
                let collectRegionVigilance = html.find('[name="collectVigilance"]')[0].value;
                let collectRegionFull = BladesHelpers.resolveActor(collectRegionUuid);
                extraFields.region = collectRegionFull;
                let collectDiceAmount = collectRegionFull.system.wealth - Number(collectRegionVigilance);
                await bladesRoll(collectDiceAmount, 'BITD.CollectRoll', note, extraFields);
                break;
              case 'cutLoose':
                let connectionUuid = html.find('[name="connection"]')[0].value;
                let stress = Number(this.actor.system.stress.value);
                extraFields.connection = BladesHelpers.resolveActor(connectionUuid);
                extraFields.stress = parseInt(stress);
                let connection = Object.values(this.actor.system.connections).find(c => c.uuid == connectionUuid);
                let cutLooseDiceAmount = Number(connection.clock.value) + extraDice;
                await bladesRoll(cutLooseDiceAmount, 'BITD.CutLooseRoll', note, extraFields);
                break;
              case 'enhance':
                extraFields.noRoll = true;
                await bladesRoll(0, 'BITD.EnhanceRoll', note, extraFields);
                break;
              case 'fix':
                let fixActorUuid = html.find('[name="fixActor"]')[0].value;
                extraFields.fixActor = BladesHelpers.resolveActor(fixActorUuid);
                let fixDice = extraDice;
                if (extraFields.fixActor.type == 'character')
                  fixDice += extraFields.fixActor.getRollData().diceAmount['engineer'];
                else
                  fixDice += extraFields.fixActor.system.quality;
                await bladesRoll(fixDice, 'BITD.FixRoll', note, extraFields);
                break;
              case 'longTermProject':
                let ltpAction = html.find('[name="ltpAction"]')[0].value;
                let ltpDice = this.actor.getRollData().diceAmount[ltpAction] + extraDice;
                let ltpSelect = dialog.element.querySelector('[name="ltpId"]');
                if (ltpSelect.multiple) {
                  extraFields.ltpIds = [];
                  for (let selectedOption of ltpSelect.selectedOptions)
                    extraFields.ltpIds.push(selectedOption.value);
                } else
                  extraFields.ltpId = ltpSelect.value;
                await bladesRoll(ltpDice, 'BITD.LongTermProjectRoll', note, extraFields);
                break;
              case 'manufacture':
                let manufactureSuccessTier = html.find('[name="manufactureSuccessTier"]')[0].value;
                let manufactureAction = html.find('[name="manufactureAction"]')[0].value;
                let manufactureDiceAmount = this.actor.getRollData().diceAmount[manufactureAction] + extraDice;
                extraFields.tier = Number(squadFull.system.tier.value);
                extraFields.successTier = manufactureSuccessTier;
                await bladesRoll(manufactureDiceAmount, 'BITD.ManufactureRoll', note, extraFields);
                break;
              case 'recover':
                let recoverActorUuid = html.find('[name="recoverActor"]')[0].value;
                extraFields.recoverActor = BladesHelpers.resolveActor(recoverActorUuid);
                let recoverDice = extraDice;
                if (extraFields.recoverActor.type == 'character') {
                  if (extraFields.recoverActor.system.doctor)
                    recoverDice += extraFields.recoverActor.getRollData().diceAmount['engineer'];
                } else
                  recoverDice += extraFields.recoverActor.system.quality;
                await bladesRoll(recoverDice, 'BITD.RecoverRoll', note, extraFields);
                break;
              case 'salvage':
                let salvageVehicleUuid = html.find('#salvageVehicle > .actor-contents').data('actorId');
                let salvageVehicleFull = BladesHelpers.resolveActor(salvageVehicleUuid);
                extraFields.salvageVehicle = salvageVehicleFull;
                let salvageDiceAmount = this.actor.getRollData().diceAmount['engineer'] + extraDice;
                await bladesRoll(salvageDiceAmount, 'BITD.SalvageRoll', note, extraFields);
                break;
              case 'schmooze':
                let schmoozeFactionUuid = html.find('#schmoozeFaction > .actor-contents').data('actorId');
                let schmoozeFactionFull = BladesHelpers.resolveActor(schmoozeFactionUuid);
                extraFields.schmoozeFaction = schmoozeFactionFull;
                let schmoozeAction = html.find('[name="schmoozeAction"]')[0].value;
                let schmoozeDiceAmount = this.actor.getRollData().diceAmount[schmoozeAction] + extraDice;
                await bladesRoll(schmoozeDiceAmount, 'BITD.SchmoozeRoll', note, extraFields);
                break;
              case 'train':
                extraFields.noRoll = true;
                let trainType = html.find('[name="trainType"]')[0].value;
                extraFields.trainType = trainType;
                await bladesRoll(0, 'BITD.TrainRoll', note, extraFields);
                break;
              case 'upkeep':
                let upkeepDice = Number(html.find('[name="upkeepDice"]')[0].value);
                extraFields.materiel = -upkeepDice;
                extraFields.upkeepDice = upkeepDice;
                await bladesRoll(upkeepDice + extraDice, 'BITD.UpkeepRoll', note, extraFields);
                break;
              case 'moveBase':
                extraFields.noRoll = true;
                await bladesRoll(0, 'BITD.MoveBaseRoll', note, extraFields);
                break;
              default:
                ui.notifications.warn(game.i18n.format('BITD.log.warn.UnknownRollType', { type: input[0].id.split('-')[0] }));
            }
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

        let allowedToRoll = true;
        let input = this.element.querySelector('input[type=radio]:checked');
        if (input) {
          let rollType = input.id.split('-')[0];
          if (rollType == 'cutLoose')
            allowedToRoll = this.element.querySelector('#collectRegion > .actor-contents').dataset.actorId != null;
          else if (rollType == 'salvage')
            allowedToRoll = this.element.querySelector('#salvageVehicle > .actor-contents').dataset.actorId != null;
          else if (rollType == 'schmooze')
            allowedToRoll = this.element.querySelector('#schmoozeFaction > .actor-contents').dataset.actorId != null;
        }

        allowedToRoll &&= checkDowntimeRules(this);
        this.element.querySelector('[data-action="roll"]').disabled = !allowedToRoll;
      };
      dialog.refreshModifiers = refreshModifiers;
      dialog.actor = this.actor;
      await dialog.render(true);

      let htmlElement = $(dialog.element);
      htmlElement[0].ondrop = function(ev) {
        ev.preventDefault();
        const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
        if (dropData.uuid) {
          let dropFull = BladesHelpers.resolveActor(dropData.uuid);
          if (dropFull.type == 'region') {
            // Drop a Region for the Collect roll
            let rollType = $(this).find('input[type=radio]:checked')[0].id.split('-')[0];
            if (rollType == 'collect')
              $(this).find('[data-action="roll"]')[0].disabled = !checkDowntimeRules(dialog);
            $(this).find('#collectRegion')[0].innerHTML = `
              <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
                <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
                <a class="item-name">${dropFull.name}</a>
                <a class="delete-actor"><i class="fas fa-times"></i></a>
              </div>`;
            $(this).find('#collectVigilance').val(Math.min(dropFull.system.collect_vigilance, 10));
            $(this).find('#collectRegion .delete-actor')[0].onclick = function (ev) {
              let rollType = $(this).closest('.form-group').find('input[type=radio]:checked')[0].id.split('-')[0];
              if (rollType == 'collect')
                $(this).closest('.window-content').find('button[data-action="roll"]')[0].disabled = true;
              $(this).closest('#collectRegion')[0].innerHTML = game.i18n.localize('BITD.None');
            }
          } else if (dropFull.type == 'vehicle') {
            // Drop a Vehicle for the Salvage roll
            if (dropFull.system.damage.deadly.one.includes(game.i18n.localize('BITD.Salvaged'))) {
              ui.notifications.warn(game.i18n.format('BITD.log.warn.SalvageVehicleAlreadySalvaged', {vehicle: dropFull.name}));
              return;
            }
            let rollType = $(this).find('input[type=radio]:checked')[0].id.split('-')[0];
            if (rollType == 'salvage') {
              let scroungersFreeActive = $(this).find('[data-modifier="scroungers_free"] input[type=checkbox]')[0].checked;
              $(this).find('[data-action="roll"]')[0].disabled = scroungersFreeActive || !checkDowntimeRules(dialog);
            }
            $(this).find('#salvageVehicle')[0].innerHTML = `
              <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
                <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
                <a class="item-name">${dropFull.name}</a>
                <a class="delete-actor"><i class="fas fa-times"></i></a>
              </div>`;
            $(this).find('#salvageVehicle .delete-actor')[0].onclick = function (ev) {
              let rollType = $(this).closest('.form-group').find('input[type=radio]:checked')[0].id.split('-')[0];
              if (rollType == 'salvage') {
                let scroungersFreeActive = $(this).closest('.window-content').find('[data-modifier="scroungers_free"] input[type=checkbox]')[0].checked;
                $(this).closest('.window-content').find('button[data-action="roll"]')[0].disabled = !scroungersFreeActive || !checkDowntimeRules(dialog);
              }
              $(this).closest('#salvageVehicle')[0].innerHTML = game.i18n.localize('BITD.None');
            }
          } else if (dropFull.type == 'faction') {
            // Drop a Faction for the Schmooze roll
            let rollType = $(this).find('input[type=radio]:checked')[0].id.split('-')[0];
            if (rollType == 'schmooze')
              $(this).find('[data-action="roll"]')[0].disabled = !checkDowntimeRules(dialog);
            $(this).find('#schmoozeFaction')[0].innerHTML = `
              <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
                <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
                <a class="item-name">${dropFull.name}</a>
                <a class="delete-actor"><i class="fas fa-times"></i></a>
              </div>`;
            $(this).find('#schmoozeFaction .delete-actor')[0].onclick = function (ev) {
              let rollType = $(this).closest('.form-group').find('input[type=radio]:checked')[0].id.split('-')[0];
              if (rollType == 'schmooze')
                $(this).closest('.window-content').find('button[data-action="roll"]')[0].disabled = true;
              $(this).closest('#schmoozeFaction')[0].innerHTML = game.i18n.localize('BITD.None');
            }
          }
        }
      };
      for (let element of htmlElement.find('input[type=radio]')) {
        element.onclick = function (ev) {
          let rollType = this.id.split('-')[0];
          let rollButton = $(this).closest('.window-content').find('button[data-action="roll"]')[0];
          let allowedToRoll = true;
          if (rollType == 'collect')
            allowedToRoll = $(this).closest('.radio-group').find('#collectRegion > .actor-contents').length != 0;
          else if (rollType == 'salvage')
            allowedToRoll = $(this).closest('.radio-group').find('#salvageVehicle > .actor-contents').length != 0;
          else if (rollType == 'schmooze')
            allowedToRoll = $(this).closest('.radio-group').find('#schmoozeFaction > .actor-contents').length != 0;

          allowedToRoll &&= checkDowntimeRules(dialog);
          rollButton.disabled = !allowedToRoll;

          for (let element of $(this).closest('.window-content').find('[data-modifier="scroungers_free"] input[type=checkbox]')) {
            element.onclick = function (ev) {
              let checked = ev.currentTarget.checked;
              let rollButton = $(this).closest('.window-content').find('button[data-action="roll"]')[0];
              let allowedToRoll = $(this).closest('.window-content').find('#salvageVehicle > .actor-contents').length != 0 ^ checked;
              allowedToRoll &&= checkDowntimeRules(dialog);
              rollButton.disabled = !allowedToRoll;
            };
          }
        };
      }
    });
  }

  // Remove unavailable roll types
  getDowntimeRollTypesToRemove() {
    let addToRollTypeError = (missingRollTypes, key, str) => {
      missingRollTypes[key] = (missingRollTypes[key] ? (missingRollTypes[key] + ', ') : '') + game.i18n.localize(str);
    }

    let rollTypes = ['acquireAsset', 'collect', 'cutLoose', 'enhance', 'fix', 'longTermProject', 'manufacture', 'recover', 'salvage', 'schmooze', 'train', 'upkeep', 'moveBase'];
    let missingRollTypes = {};

    let trainTypes = ['playbook'];
    for (let [trainTypeName, trainType] of Object.entries(this.actor.system.attributes))
      // No vehicle: Don't include vehicle attributes
      if (BladesHelpers.resolveActor(this.actor.system.vehicle) || !trainType.is_vehicle)
        trainTypes.push(trainTypeName);
    for (let usedTrainType of Object.keys(this.actor.system.downtime_activities.train_types))
      trainTypes.splice(trainTypes.indexOf(usedTrainType), 1);
    if (trainTypes.length == 0)
      addToRollTypeError(missingRollTypes, 'train', 'BITD.BadDowntimeRoll.NoTraining');
    if (!this.actor.system.harm.light.one && !this.actor.system.harm.light.two && !this.actor.system.harm.medium.one && !this.actor.system.harm.medium.two && !this.actor.system.harm.heavy.one && !this.actor.system.harm.deadly.one)
      addToRollTypeError(missingRollTypes, 'recover', 'BITD.BadDowntimeRoll.NoHarm');
    if (Object.values(this.actor.system.connections).length == 0)
      addToRollTypeError(missingRollTypes, 'cutLoose', 'BITD.BadDowntimeRoll.NoConnection');
    let squadFull = BladesHelpers.resolveActor(this.actor.system.crew);
    if (squadFull && squadFull.system.conditional_roll_modifiers.character.conviction_extra && Number(this.actor.system.conviction_uses.value) < this.actor.system.conviction_uses.max) {}
    else if (Number(this.actor.system.stress.value) <= 0)
      addToRollTypeError(missingRollTypes, 'cutLoose', 'BITD.BadDowntimeRoll.NoStress');
    if (!this.actor.system.vehicle) {
      addToRollTypeError(missingRollTypes, 'enhance', 'BITD.BadDowntimeRoll.NoVehicle');
      addToRollTypeError(missingRollTypes, 'fix', 'BITD.BadDowntimeRoll.NoVehicle');
      addToRollTypeError(missingRollTypes, 'upkeep', 'BITD.BadDowntimeRoll.NoVehicle');
    } else {
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      if (!vehicleFull.system.damage.light.one && !vehicleFull.system.damage.light.two && !vehicleFull.system.damage.medium.one && !vehicleFull.system.damage.medium.two && !vehicleFull.system.damage.heavy.one && !vehicleFull.system.damage.deadly.one)
        addToRollTypeError(missingRollTypes, 'fix', 'BITD.BadDowntimeRoll.NoDamage');
      if (!Object.values(vehicleFull.system.quirks).find(q => !q.usable))
        addToRollTypeError(missingRollTypes, 'upkeep', 'BITD.BadDowntimeRoll.NoExhaustedQuirk');
    }
    if (!this.actor.system.crew) {
      addToRollTypeError(missingRollTypes, 'acquireAsset', 'BITD.BadDowntimeRoll.NoSquad');
      addToRollTypeError(missingRollTypes, 'collect', 'BITD.BadDowntimeRoll.NoSquad');
      addToRollTypeError(missingRollTypes, 'longTermProject', 'BITD.BadDowntimeRoll.NoSquad');
      addToRollTypeError(missingRollTypes, 'manufacture', 'BITD.BadDowntimeRoll.NoSquad');
      addToRollTypeError(missingRollTypes, 'salvage', 'BITD.BadDowntimeRoll.NoSquad');
      addToRollTypeError(missingRollTypes, 'schmooze', 'BITD.BadDowntimeRoll.NoSquad');
      addToRollTypeError(missingRollTypes, 'upkeep', 'BITD.BadDowntimeRoll.NoSquad');
      addToRollTypeError(missingRollTypes, 'moveBase', 'BITD.BadDowntimeRoll.NoSquad');
    } else {
      if (!Object.values(squadFull.system.projects).filter(p => Number(p.clock.value) < Number(p.clock.max)).length)
        addToRollTypeError(missingRollTypes, 'longTermProject', 'BITD.BadDowntimeRoll.NoOngoingLTP');
      if (Number(squadFull.system.materiel.value) <= 0)
        addToRollTypeError(missingRollTypes, 'upkeep', 'BITD.BadDowntimeRoll.NoMateriel');
      if (!squadFull.system.mobile_base)
        addToRollTypeError(missingRollTypes, 'moveBase', 'BITD.BadDowntimeRoll.NoMobileBase');
    }
    return [
      rollTypes.filter(r => !Object.keys(missingRollTypes).includes(r)),
      Object.fromEntries(Object.entries(missingRollTypes).map((v, i) => [game.i18n.localize(`BITD.${v[0][0].toUpperCase() + v[0].slice(1)}Roll`), v[1]]))
    ];
  }
}
