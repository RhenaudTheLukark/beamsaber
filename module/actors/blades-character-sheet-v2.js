import { BladesSheetV2 } from '../blades-sheet.js';
import { BladesActiveEffect } from '../blades-active-effect.js';
import { BladesHelpers } from '../blades-helpers.js';
import { bladesRoll, simpleRollPopup, buildRollPopup, resolveRollModifierArray, resolveConditionalModifiers,
  dialogOnFirstRender, dialogOnRender, refreshModifiers, postRollProcessing, pruneInvalidConditionalRollModifiers,
  keepValidModifiersFromOther } from '../blades-roll.js';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {BladesSheetV2}
 */
export class BladesCharacterSheetV2 extends BladesSheetV2 {

  /** @override */
  // TODO: Upgrade to V2(?)
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      tabs: [{ navSelector: '.tabs', contentSelector: '.tab-content', initial: 'abilities' }]
    });
  }

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    classes: ['beamsaber', 'sheet', 'actor', 'character', 'themed', 'theme-light'],
    position: {
      width: 790,
      height: 890,
    },
    window: {
      resizable: true
    },
    tag: 'form',
    form: {
      handler: this.#onSubmitForm,
      closeOnSubmit: false,
      submitOnChange: true
    },
    actions: {
      editImage: this.#editImage,
      spark: this.#spark,
      deleteClass: this.#deleteClass,
      deleteSquad: this.#deleteSquad,
      deleteVehicle: this.#deleteVehicle,
      deleteRegion: this.#deleteRegion,
      addOldConnection: this.#addOldConnection,
      upgradeConnection: this.#upgradeConnection,
      deleteConnection: this.#deleteConnection,
      addQuirk: this.#addQuirk,
      deleteQuirk: this.#deleteQuirk,
      stayLate: this.#stayLate,
      formToggle: this.#formToggle,
      collapse: this.#collapse,
      vehicleData: this.#vehicleData,
      otherRolls: this.#otherRolls,
      downtime: this.#downtime
    },
    sheet: {
      tabs: [
        { id: 'mech-load', group: 'sheet', label: 'BITD.VehicleLoadout' },
        { id: 'abilities', group: 'sheet', label: 'BITD.Abilities' },
        { id: 'loadout', group: 'sheet', label: 'BITD.Loadout' },
        { id: 'connections', group: 'sheet', label: 'BITD.Connections' },
        { id: 'notes', group: 'sheet', label: 'BITD.Notes' },
        { id: 'effects', group: 'sheet', label: 'BITD.Effects' },
        { id: 'all_items', group: 'sheet', label: 'BITD.AllItems' }
      ],
      initial: 'abilities'
    }
  };

  /** @inheritDoc */
  static PARTS = {
    form: {
      template: 'systems/beamsaber/templates/actors/character-sheet-v2.html'
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    let context = await super._prepareContext(options);

    context.owner = context.owner;
    context.editable = context.editable;
    context.actor = this.document;
    context.isGM = game.user.isGM;

    let actor = context.actor;

    // Prepare active effects
    actor.preparedEffects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);

    // Calculate Load
    actor.system.load = BladesHelpers.computeLoad(actor, false);

    // Fetch crew, vehicle & region data
    actor.system.crew = BladesHelpers.resolveActor(actor.system.crew, { name: 'Unknown Squad' });
    actor.system.vehicle = BladesHelpers.resolveActor(actor.system.vehicle, { name: 'Unknown Vehicle' });
    actor.system.region = BladesHelpers.resolveActor(actor.system.region, { name: 'Unknown Region' });

    actor.system.class = BladesHelpers.getOwnedItem(this.actor, actor.system.class);

    // Get all connection actors
    for (let connection of Object.values(actor.system.connections))
      connection.actor = BladesHelpers.resolveActor(connection.uuid, { name: 'Unknown Connection' });
    actor.system.resolved_connections = Object.values(actor.system.connections);

    // Calculate Vehicle Load
    if (actor.system.vehicle && actor.system.vehicle.system)
      actor.system.vehicle.system.load = BladesHelpers.computeLoad(actor.system.vehicle, true);

    // Get all sheet value modifiers
    [actor.system.modifiers, actor.system.roll_modifiers, actor.system.conditional_roll_modifiers] = this.actor.getModifiers();
    this.actor.applyModifiers(actor);

    // Extra data used in the sheet
    actor.hasActiveAdvancedPrototype = actor.items.find(i => i.system.experimental == true) !== undefined;
    actor.hasActiveHiddenItem = actor.items.find(i => i.system.hidden == true) !== undefined;

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
    actor.system.load_level = actor.system.mule ? mule_level[actor.system.load] : load_level[actor.system.load];
    if (actor.system.vehicle && actor.system.vehicle.system)
      actor.system.vehicle.system.load_level = load_level[actor.system.vehicle.system.load];

    if (game.settings.get('beamsaber', 'DeepCutLoad')) {
      actor.system.load_levels = { 'BITD.Discreet': 'BITD.Discreet', 'BITD.Conspicuous': 'BITD.Conspicuous' };
    } else {
      actor.system.load_levels = {
        'BITD.Light': 'BITD.Light',
        'BITD.Normal': 'BITD.Normal',
        'BITD.Heavy': 'BITD.Heavy'
      };
    }

    actor.defaultClockThemeColor = game.settings.get('beamsaber', 'DefaultClockThemeColor');

    actor.specialAmmunitionDropdown = {
      'flak': 'BITD.AmmoTypeFlak',
      'armor_piercing': 'BITD.AmmoTypeArmorPiercing',
      'incendiary': 'BITD.AmmoTypeIncendiary',
      'other': 'BITD.AmmoTypeOther',
    }

    actor.hackrigTypeDropdown = {
      'tablet': 'BITD.HackrigTypeTablet',
      'laptop': 'BITD.HackrigTypeLaptop',
      'tower': 'BITD.HackrigTypeTower',
      'other': 'BITD.HackrigTypeOther'
    }

    actor.droneTypeDropdown = {
      'pilot': 'BITD.Pilot',
      'vehicle': 'BITD.VehicleName'
    }

    actor.expertiseDropdown = {'': 'None'};
    for (let action of BladesHelpers.getAllActions())
      actor.expertiseDropdown[action] = BladesHelpers.getAttributeLabel(action);

    actor.gearOwner = actor;

    // Update container loads
    for (let container of actor.items.filter(i => i.system.is_container)) {
      let [owner, _] = this.actor.getItemOwner(container);
      container.system.container_computed_load = BladesHelpers.computeMaxLoad(owner, container);
      container.system.current_load = BladesHelpers.computeLoad(owner, false, container._id);
      container.system.container_item_types_str = container.system.container_item_types.join(',');
    }

    return context.actor;
  }

  // Handle form submission
  static async #onSubmitForm(event, form, formData) {
    event.preventDefault();
    await this.document.update(formData.object);
  }

  /** @override */
  // TODO: Upgrade to V2
  async _onDropItem(event, droppedItem) {
    await super._onDropItem(event, droppedItem);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedItem);
  }

  /** @override */
  // TODO: Upgrade to V2
  async _onDropActor(event, droppedActor) {
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedActor);
  }

  /** @override */
  // TODO: Upgrade to V2
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

  async onSparkToggleRightClick(event) {
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

        let input = dialog.element.querySelector('input[type=radio]:checked');
        let note = dialog.element.querySelector('[name="note"]').value;
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

  static async #editImage(event, target) {
    const field = target.dataset.field || "img";
    const current = foundry.utils.getProperty(this.document, field);

    const fp = new foundry.applications.apps.FilePicker({
      type: "image",
      current: current,
      callback: (path) => this.document.update({[field]: path})
    });
    fp.render(true);
  }

  static async #spark(event, target) {
    event.preventDefault();
    this._onSparkToggleLeftClick(event);
  }

  // Delete Character's Class
  static async #deleteClass(event, target) {
    await BladesHelpers.tryUpdate(this.actor, {'system.class': null});
  }

  // Remove Squad from character sheet
  static async #deleteSquad(event, target) {
    await BladesHelpers.removeSquadCharacter(this.actor);
  }

  // Remove Vehicle from character sheet
  static async #deleteVehicle(event, target) {
    await BladesHelpers.removeCharacterVehicle(this.actor);
  }

  // Remove Region from character sheet
  static async #deleteRegion(event, target) {
    await BladesHelpers.removeCharacterRegion(this.actor);
  }

  static async #addOldConnection(event, target) {
    const connections = this.actor.system.connections;
    connections[Object.keys(connections).length] = {
      name: '',
      clock: {
        value: 0,
        max: 4,
        min: 0
      },
      beliefs: {
        '0': '',
        '1': '',
        '2': '',
        '3': ''
      },
      discoveries: ''
    }
    await BladesHelpers.tryUpdate(this.actor, {'system.==connections': connections});
  }

  static async #upgradeConnection(event, target) {
    const element = target.closest('.item');
    const currentConnectionId = element.dataset.connectionId;

    const contents = `
      <h2>${game.i18n.localize('BITD.UpgradeConnection')}</h2>
      <p>${game.i18n.localize('BITD.UpgradeConnectionInfo')}</p>
      <div class="form-group" data-actor-id="${this.actor.uuid}"></div>`;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('BITD.UpgradeConnection')}` },
      content: contents,
      classes: ['upgrade-connection'],
      buttons: [
        {
          icon: 'fas fa-floppy-disk',
          label: game.i18n.localize('BITD.Update'),
          action: 'update',
          disabled: true,
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'update') return;

        const updateObject = {};
        updateObject[`system.connections.${currentConnectionId}.uuid`] = dialog._value;
        await BladesHelpers.tryUpdate(this.actor, updateObject);
      }
    });
    dialog._value = null;
    dialog.actor = this.actor;
    await dialog.render(true);

    dialog.element.ondrop = async function(ev) {
      ev.preventDefault();
      const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
      if (dropData.uuid) {
        const dropFull = BladesHelpers.resolveActor(dropData.uuid);
        const actorUuid = this.querySelector('[data-actor-id]').dataset.actorId;
        const actorFull = BladesHelpers.resolveActor(actorUuid);
        if (!['character', 'npc'].includes(dropFull.type)) {
          const {type, id, collection} = foundry.utils.parseUuid(dropData.uuid) ?? {};
          ui.notifications.warn(game.i18n.format('BITD.log.warn.UpgradeConnectionBadType', {type: game.i18n.localize(`TYPES.${type}.${dropFull.type}`)}));
          dialog._value = null;
        } else if (Object.values(actorFull.system.connections).find(c => c.uuid == dropData.uuid)) {
          ui.notifications.warn(game.i18n.format('BITD.log.warn.UpgradeConnectionDuplicate'), {dropped: dropFull.name, owner: actorFull.name});
          dialog._value = null;
        } else
          dialog._value = dropData.uuid;
        this.querySelector('[data-action="update"]').disabled = dialog._value == null;
        this.querySelector('.form-group').innerHTML = dialog._value == null ? '' : `
          <div class="actor-contents flex-horizontal">
            <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="48" height="48"/>
            <a class="item-name">${dropFull.name}</a>
          </div>`
      }
    };
  }

  // Delete Connection
  static async #deleteConnection(event, target) {
    const element = target.closest('.item');
    const currentConnectionId = element.dataset.connectionId;
    const connectionsEntries = Object.entries(this.actor.system.connections);
    connectionsEntries.splice(currentConnectionId, 1);
    for (let id in connectionsEntries)
      connectionsEntries[id][0] = String(id);
    await BladesHelpers.tryUpdate(this.actor, {'system.==connections': Object.fromEntries(connectionsEntries)});
  }

  // Add Quirk
  static async #addQuirk(event, target) {
    if (!this.actor.system.vehicle) return;
    const vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
    if (!vehicleFull) return;
    const quirks = vehicleFull.system.quirks;
    quirks[Object.keys(quirks).length] = { name: '', usable: true };
    await BladesHelpers.tryUpdate(vehicleFull, {'system.==quirks': quirks});
    await this.actor.sheet.render(true);
  }

  // Delete Quirk
  static async #deleteQuirk(event, target) {
    if (!this.actor.system.vehicle) return;
    const vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
    if (!vehicleFull) return;
    const element = target.closest('.item');
    let currentQuirkId = element.dataset.quirkId;
    let quirksEntries = Object.entries(vehicleFull.system.quirks);
    quirksEntries.splice(currentQuirkId, 1);
    for (let id in quirksEntries)
      quirksEntries[id][0] = String(id);
    await BladesHelpers.tryUpdate(vehicleFull, {'system.==quirks': Object.fromEntries(quirksEntries)});
    await this.actor.sheet.render(true);
  }

  // Use Stay Late
  static async #stayLate(event, target) {
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
        ${otherMembers.map((member, i) => `${i % 2 == 0 ? '<tr>' : ''}<td class="actor-cell" data-actor-id="${member.uuid}">
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
      })
    }
  }

  // Update Vehicle Gear Form (.form-toggle > button')
  static async #formToggle(event, target) {
    const element = target.closest('.item');
    let currentItemId = element.dataset.itemId;
    let item = this.actor.items.get(currentItemId);
    await BladesHelpers.tryUpdate(item, {'system.form': (item.system.form + 1) % 3});
    if (!this.actor.system.vehicle) return;
    let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
    if (vehicleFull)
      vehicleFull.updateVehicleForm();
  };

  // Collapse item containers
  static async #collapse(event, target) {
    const element = target.closest('.item');
    let currentItemId = element.dataset.itemId;
    let item = this.actor.items.get(currentItemId);
    let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
    let childrenElement = element.parentElement.querySelector('.item-container');
    childrenElement.slideToggle(200, async () => {
      await BladesHelpers.tryUpdate(item, {'system.collapsed': !item.system.collapsed});
      if (vehicleFull)
        await vehicleFull.sheet.render(true);
    });
  };

  // Update any vehicle data ('input[type=radio].vehicle-data, input[type=checkbox].vehicle-data')
  static async #vehicleData(event, target) {
    let path = target.dataset.name;
    let value = target.type == 'checkbox' ? target.checked : target.value;
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
  }

  static async #otherRolls(event, target) {
    await simpleRollPopup('BITD.OtherRoll', 'BITD.OtherRollFull', this.actor, false);
  }

  // Downtime Roll Menu
  static async #downtime(event, target) {
    // Fetch roll modifiers
    let [_, allPermanentModifiers, allConditionalModifiers] = this.actor.getModifiers();
    allPermanentModifiers = await resolveRollModifierArray(allPermanentModifiers, this.actor);
    allConditionalModifiers = await resolveRollModifierArray(allConditionalModifiers, this.actor);
    allConditionalModifiers = pruneInvalidConditionalRollModifiers(this.actor, allConditionalModifiers);

    let title = `${game.i18n.localize('BITD.DowntimeActivity')} (${game.i18n.format('BITD.DowntimeRollLeft', {num: Math.max(this.actor.system.downtime_count.value, 0)})})`;
    let [rollTypes, missingRollTypes] = this.getDowntimeRollTypesToRemove();

    let dialog = new foundry.applications.api.DialogV2({
      window: { title: title },
      content: buildRollPopup(title, this.actor, rollTypes, missingRollTypes),
      buttons: [
        {
          icon: 'fas fa-check',
          label: game.i18n.localize('BITD.Roll'),
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

        let extraDice = parseInt(dialog.element.querySelector('[name="mod"]').value);
        let note = dialog.element.querySelector('[name="note"]').value;

        // Fetch enabled conditional roll modifiers by HTML inspection
        let enabledConditionalModifiers = resolveConditionalModifiers(dialog, this.actor);
        enabledConditionalModifiers = keepValidModifiersFromOther(enabledConditionalModifiers);

        let input = dialog.element.querySelector('input[type=radio]:checked');
        if (input) {
          let rollType = input.id.split('-')[0];
          let extraFields = { roll_type: rollType, modifiers: [ ...dialog.permanentModifiers, ...enabledConditionalModifiers ], actor: this.actor };
          let squadFull = BladesHelpers.resolveActor(this.actor.system.crew);
          switch (rollType) {
            case 'acquireAsset':
              let acquireAssetSuccessTier = dialog.element.querySelector('[name="acquireAssetSuccessTier"]').value;
              let acquireAssetDiceAmount = Number(squadFull.system.tier.value) + extraDice;
              extraFields.tier = Number(squadFull.system.tier.value);
              extraFields.successTier = acquireAssetSuccessTier;
              await bladesRoll(acquireAssetDiceAmount, 'BITD.AcquireAssetRoll', note, extraFields);
              break;
            case 'collect':
              let collectRegionUuid = dialog.element.querySelector('#collectRegion > .actor-contents').dataset.actorId;
              let collectRegionVigilance = dialog.element.querySelector('[name="collectVigilance"]').value;
              let collectRegionFull = BladesHelpers.resolveActor(collectRegionUuid);
              extraFields.region = collectRegionFull;
              let collectDiceAmount = collectRegionFull.system.wealth - Number(collectRegionVigilance);
              await bladesRoll(collectDiceAmount, 'BITD.CollectRoll', note, extraFields);
              break;
            case 'cutLoose':
              let connectionUuid = dialog.element.querySelector('[name="connection"]').value;
              let stress = Number(this.actor.system.stress.value);
              extraFields.connection = BladesHelpers.resolveActor(connectionUuid);
              extraFields.stress = parseInt(stress);
              let connection = BladesHelpers.fetchConnectionsToActor(this.actor.uuid).find(c => c.uuid == connectionUuid);
              let cutLooseDiceAmount = Number(connection.clock.value) + extraDice;
              await bladesRoll(cutLooseDiceAmount, 'BITD.CutLooseRoll', note, extraFields);
              break;
            case 'enhance':
              extraFields.noRoll = true;
              await bladesRoll(0, 'BITD.EnhanceRoll', note, extraFields);
              break;
            case 'fix':
              let fixActorUuid = dialog.element.querySelector('[name="fixActor"]').value;
              extraFields.fixActor = BladesHelpers.resolveActor(fixActorUuid);
              let fixDice = extraDice;
              if (extraFields.fixActor.type == 'character')
                fixDice += extraFields.fixActor.getRollData().diceAmount['engineer'];
              else
                fixDice += extraFields.fixActor.system.quality;
              await bladesRoll(fixDice, 'BITD.FixRoll', note, extraFields);
              break;
            case 'longTermProject':
              let ltpAction = dialog.element.querySelector('[name="ltpAction"]').value;
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
              let manufactureSuccessTier = dialog.element.querySelector('[name="manufactureSuccessTier"]').value;
              let manufactureAction = dialog.element.querySelector('[name="manufactureAction"]').value;
              let manufactureDiceAmount = this.actor.getRollData().diceAmount[manufactureAction] + extraDice;
              extraFields.tier = Number(squadFull.system.tier.value);
              extraFields.successTier = manufactureSuccessTier;
              await bladesRoll(manufactureDiceAmount, 'BITD.ManufactureRoll', note, extraFields);
              break;
            case 'recover':
              let recoverActorUuid = dialog.element.querySelector('[name="recoverActor"]').value;
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
              let salvageVehicleUuid = dialog.element.querySelector('#salvageVehicle > .actor-contents').dataset.actorId;
              let salvageVehicleFull = BladesHelpers.resolveActor(salvageVehicleUuid);
              extraFields.salvageVehicle = salvageVehicleFull;
              let salvageDiceAmount = this.actor.getRollData().diceAmount['engineer'] + extraDice;
              await bladesRoll(salvageDiceAmount, 'BITD.SalvageRoll', note, extraFields);
              break;
            case 'schmooze':
              let schmoozeFactionUuid = dialog.element.querySelector('#schmoozeFaction > .actor-contents').dataset.actorId;
              let schmoozeFactionFull = BladesHelpers.resolveActor(schmoozeFactionUuid);
              extraFields.schmoozeFaction = schmoozeFactionFull;
              let schmoozeAction = dialog.element.querySelector('[name="schmoozeAction"]').value;
              let schmoozeDiceAmount = this.actor.getRollData().diceAmount[schmoozeAction] + extraDice;
              await bladesRoll(schmoozeDiceAmount, 'BITD.SchmoozeRoll', note, extraFields);
              break;
            case 'train':
              extraFields.noRoll = true;
              let trainType = dialog.element.querySelector('[name="trainType"]').value;
              extraFields.trainType = trainType;
              await bladesRoll(0, 'BITD.TrainRoll', note, extraFields);
              break;
            case 'upkeep':
              let upkeepDice = Number(dialog.element.querySelector('[name="upkeepDice"]').value);
              extraFields.materiel = -upkeepDice;
              await bladesRoll(upkeepDice + extraDice, 'BITD.UpkeepRoll', note, extraFields);
              break;
            default:
              ui.notifications.warn(game.i18n.format('BITD.log.warn.UnknownRollType', { type: input.id.split('-')[0] }));
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

      let input = this.querySelector('input[type=radio]:checked');
      if (input) {
        let rollType = input.id.split('-')[0];
        let rollButton = this.querySelector('[data-action="roll"]');
        let allowedToRoll = true;
        if (rollType == 'cutLoose') {
          let collectRegionUuid = this.querySelector('#collectRegion > .actor-contents').dataset.actorId;
          allowedToRoll = collectRegionUuid != null;
        } else if (rollType == 'salvage') {
          let salvageVehicle = this.querySelector('#salvageVehicle > .actor-contents').dataset.actorId;
          allowedToRoll = salvageVehicle != null;
        } else if (rollType == 'schmooze') {
          let schmoozeFaction = this.querySelector('#schmoozeFaction > .actor-contents').dataset.actorId;
          allowedToRoll = schmoozeFaction != null;
        }
        allowedToRoll &&= checkDowntimeRules(dialog);
        rollButton.disabled = !allowedToRoll;
      }
    };
    dialog.refreshModifiers = refreshModifiers;
    dialog.actor = this.actor;
    await dialog.render(true);

    dialog.element.ondrop = async function(ev) {
      ev.preventDefault();
      const dropData = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
      if (dropData.uuid) {
        let dropFull = BladesHelpers.resolveActor(dropData.uuid);
        if (dropFull.type == 'region') {
          // Drop a Region for the Collect roll
          let rollType = this.querySelector('input[type=radio]:checked').id.split('-')[0];
          if (rollType == 'collect')
            this.querySelector('[data-action="roll"]').disabled = !checkDowntimeRules(dialog);
          this.querySelector('#collectRegion').innerHTML = `
            <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
              <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
              <a class="item-name">${dropFull.name}</a>
              <a class="delete-actor"><i class="fas fa-times"></i></a>
            </div>`;
          this.querySelector('#collectVigilance').value = Math.min(dropFull.system.collect_vigilance, 10);
          this.querySelector('#collectRegion .delete-actor').onclick = function (ev) {
            let rollType = this.closest('.form-group').querySelector('input[type=radio]:checked').id.split('-')[0];
            if (rollType == 'collect')
              this.closest('.window-content').querySelector('button[data-action="roll"]').disabled = true;
            this.closest('#collectRegion').innerHTML = game.i18n.localize('BITD.None');
          }
        } else if (dropFull.type == 'vehicle') {
          // Drop a Vehicle for the Salvage roll
          if (dropFull.system.damage.deadly.one.includes(game.i18n.localize('BITD.Salvaged'))) {
            ui.notifications.warn(game.i18n.format('BITD.log.warn.SalvageVehicleAlreadySalvaged', {vehicle: dropFull.name}));
            return;
          }
          let rollType = this.querySelector('input[type=radio]:checked').id.split('-')[0];
          if (rollType == 'salvage')
            this.querySelector('[data-action="roll"]').disabled = !checkDowntimeRules(dialog);
          this.querySelector('#salvageVehicle').innerHTML = `
            <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
              <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
              <a class="item-name">${dropFull.name}</a>
              <a class="delete-actor"><i class="fas fa-times"></i></a>
            </div>`;
          this.querySelector('#salvageVehicle .delete-actor').onclick = function (ev) {
            let rollType = this.closest('.form-group').querySelector('input[type=radio]:checked').id.split('-')[0];
            if (rollType == 'salvage')
              this.closest('.window-content').querySelector('button[data-action="roll"]').disabled = true;
            this.closest('#salvageVehicle').innerHTML = game.i18n.localize('BITD.None');
          }
        } else if (dropFull.type == 'faction') {
          // Drop a Faction for the Schmooze roll
          let rollType = this.querySelector('input[type=radio]:checked').id.split('-')[0];
          if (rollType == 'schmooze')
            this.querySelector('[data-action="roll"]').disabled = !checkDowntimeRules(dialog);
          this.querySelector('#schmoozeFaction').innerHTML = `
            <div class="actor-contents flex-horizontal" data-actor-id="${dropData.uuid}">
              <img src="${dropFull.img}" data-tooltip="${dropFull.name}" width="32" height="32"/>
              <a class="item-name">${dropFull.name}</a>
              <a class="delete-actor"><i class="fas fa-times"></i></a>
            </div>`;
          this.querySelector('#schmoozeFaction .delete-actor').onclick = function (ev) {
            let rollType = this.closest('.form-group').querySelector('input[type=radio]:checked').id.split('-')[0];
            if (rollType == 'schmooze')
              this.closest('.window-content').querySelector('button[data-action="roll"]').disabled = true;
            this.closest('#schmoozeFaction').innerHTML = game.i18n.localize('BITD.None');
          }
        }
      }
    };
    for (let element of dialog.element.querySelectorAll('input[type=radio]')) {
      element.addEventListener('click', (ev) => {
        let rollType = this.id.split('-')[0];
        let rollButton = this.closest('.window-content').querySelector('button[data-action="roll"]');
        let allowedToRoll = true;
        if (rollType == 'collect')
          allowedToRoll = this.closest('.radio-group').querySelector('#collectRegion > .actor-contents') != null;
        else if (rollType == 'salvage')
          allowedToRoll = this.closest('.radio-group').querySelector('#salvageVehicle > .actor-contents') != null;
        else if (rollType == 'schmooze')
          allowedToRoll = this.closest('.radio-group').querySelector('#schmoozeFaction > .actor-contents') != null;

        allowedToRoll &&= checkDowntimeRules(dialog);
        rollButton.disabled = !allowedToRoll;
      });
    }
  };

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    this.element.querySelector('.spark').addEventListener('contextmenu', ev => this.onSparkToggleRightClick(ev));

    // Update Expertise Action
    this.element.querySelector('.expertise > select').addEventListener('change', async ev => {
      const element = ev.currentTarget.closest('.item');
      let currentItemId = element.dataset.itemId;
      const selectedAction = ev.currentTarget.value;
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.expertise_action': selectedAction});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Vehicle Gear Experimental Toggle
    this.element.querySelector('.experimental > input').addEventListener('change', async ev => {
      const element = ev.currentTarget.closest('.item');
      let currentItemId = element.dataset.itemId;
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.experimental': ev.currentTarget.checked});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Items' Hidden Toggle
    this.element.querySelector('.hidden-item > input').addEventListener('change', async ev => {
      const element = ev.currentTarget.closest('.item');
      let currentItemId = element.dataset.itemId;
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.hidden': ev.currentTarget.checked});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Item Uses
    this.element.querySelector('.uses > input').addEventListener('change', async ev => {
      const element = ev.currentTarget.closest('.item');
      let currentItemId = element.dataset.itemId;
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.uses.value': ev.currentTarget.value});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Item Description
    this.element.querySelector('.extra-description > textarea').addEventListener('change', async ev => {
      const element = ev.currentTarget.closest('.item');
      let currentItemId = element.dataset.itemId;
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.extra_description': ev.currentTarget.value});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Hackrig Type
    this.element.querySelector('.hackrig-type > select').addEventListener('change', async ev => {
      const element = ev.currentTarget.closest('.item');
      let currentItemId = element.dataset.itemId;
      let item = this.actor.items.get(currentItemId);
      let newHackrigType = ev.currentTarget.value;
      let hackrigLoad = newHackrigType == 'tablet' ? 3 : newHackrigType == 'laptop' ? 5 : newHackrigType == 'tower' ? 6 : item.system.container_load;
      await BladesHelpers.tryUpdate(item, {'system.container_type': newHackrigType, 'system.container_load': hackrigLoad});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Special Ammunition
    this.element.querySelector('.ammo > select').addEventListener('change', async ev => {
      const element = ev.currentTarget.closest('.item');
      let currentItemId = element.dataset.itemId;
      const selectedAmmo = ev.currentTarget.value;
      let item = this.actor.items.get(currentItemId);
      await BladesHelpers.tryUpdate(item, {'system.special_ammunition_type': selectedAmmo});
      let vehicleFull = BladesHelpers.resolveActor(this.actor.system.vehicle);
      await vehicleFull.sheet.render(true);
    });

    // Update Drone Item Type
    this.element.querySelector('.drone-type > select').addEventListener('change', async ev => {
      const element = ev.currentTarget.closest('.item');
      let currentItemId = element.dataset.itemId;
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

    // Update Any Vehicle Data
    this.element.querySelector('select.vehicle-data, input[type=text].vehicle-data').addEventListener('change', this.#vehicleData);
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
    if (Number(this.actor.system.stress.value) <= 0 || (squadFull && squadFull.system.conditional_roll_modifiers.characters.conviction_extra && Number(this.actor.system.conviction_uses.value) < this.actor.system.conviction_uses.max))
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
