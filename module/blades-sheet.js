import { BladesActiveEffect } from './blades-active-effect.js';
import { BladesHelpers } from './blades-helpers.js';

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {foundry.appv1.sheets.ActorSheet}
 */

export class BladesSheet extends foundry.appv1.sheets.ActorSheet {

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find('.item-add-popup').click(this.onItemAddClick.bind(this));
    html.find('.actor-add-popup').click(this.onActorAddClick.bind(this));
    html.find('.update-box').click(this.onUpdateBoxClick.bind(this));

    html.find('label.radio-toggle').click((e) => {
      BladesHelpers.onRadioToggle(e);
      e.preventDefault();
    });
    html.find('label.radio-toggle').contextmenu((e) => {
      BladesHelpers.onRadioToggle(e);
      e.preventDefault();
    });
    html.find('label.radio-toggle.middle').mousedown((e) => {
      // Middle click
      if (e && (e.which == 2 || e.button == 1)) {
        this.onRadioMiddleClick(e);
        e.preventDefault();
      }
    });

    // Post item to chat
    html.find('.item-post').click((ev) => {
      const element = $(ev.currentTarget).closest('.item');
      const item = this.actor.items.get(element.data('itemId'));
      item.sendToChat();
    });

    // This is a workaround until is being fixed in FoundryVTT.
    if (this.options.submitOnChange)
      html.on('change', 'textarea', this._onChangeInput.bind(this));  // Use delegated listener on the form

    html.find('.roll-die-attribute').click(this.onRollAttributeDieClick.bind(this));

    // Update Inventory Item
    html.find('.item-body').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      const item = this.actor.items.get(element.data('itemId'));
      if (!item && this.actor.type == 'vehicle') {
        ui.notifications.warn(game.i18n.localize('BITD.log.warn.NotItemOwnerVehicle'));
        return;
      }
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.delete-item').click(async ev => {
      var element = $(ev.currentTarget).closest('.item');
      const item = this.actor.items.get(element.data('itemId'));
      if (element.parent().hasClass('item-with-container'))
        element = element.parent();
      element.slideUp(200, async () => await this.actor.removeItem(item));
    });

    // Open Actor
    html.find('.open-actor').click(async ev => {
      const element = $(ev.currentTarget).closest('.item');
      //acqId is the UUID of the Actor
      const acqId = element.data('itemId');
      var actor = BladesHelpers.resolveActor(acqId);
      if (!actor) {
        const acqUuid = element.data('itemUuid');
        actor = BladesHelpers.resolveActor(acqUuid);
      }
      actor?.sheet.render(true);
    });

    // Update Trust
    html.find('.trust-block label.input').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      const entityFull = BladesHelpers.resolveActor(element.data("itemId"));
      if (entityFull)
        await BladesHelpers.handleRelationshipValue(this.actor, entityFull, 'trust', $(ev.currentTarget).data('value'), true);
    });

    // Update Beliefs
    html.find('.beliefs-block input').change(async ev => {
      const element = ev.currentTarget.closest(".item");
      const entityFull = BladesHelpers.resolveActor(element.dataset.itemId);
      if (entityFull)
        await BladesHelpers.handleRelationshipValue(this.actor, entityFull, 'beliefs', ev.currentTarget.value, true);
    });

    // Update Relationship Status
    html.find('.status-block label.input').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      const entityFull = BladesHelpers.resolveActor(element.data("itemId"));
      if (entityFull)
        await BladesHelpers.handleRelationshipValue(this.actor, entityFull, 'status', $(ev.currentTarget).data('value'), true);
    });

    // Delete Relationship
    html.find('.delete-relationship:not(.disabled-item)').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      const entityFull = BladesHelpers.resolveActor(element.data("itemId"));
      if (entityFull)
        BladesHelpers.removeRelationship(this.actor, entityFull);
    });

    html.find('.death-toggle').click(async ev => {
      const targetId = $(ev.currentTarget).data('targetId') ?? this.actor.uuid;
      const targetFull = BladesHelpers.resolveActor(targetId);
      await BladesHelpers.tryUpdate(targetFull, {'system.==dead': !targetFull.system.dead});
      const pilotFull = BladesHelpers.resolveActor(targetFull.system.pilot);
      if (pilotFull)
        await BladesHelpers.tryUpdate(pilotFull, {'==name': pilotFull.name});
    });

    // manage active effects
    html.find('.effect-control').click(ev => BladesActiveEffect.onManageActiveEffect(ev, this.actor));

    html.find('.clock-style-picker').click(async ev => {
      const element = ev.currentTarget;
      const path = element.dataset.path;
      const themeColor = element.dataset.themeColor;
      const isVehicleProxy = element.dataset.isVehicleProxy;
      const isVehicle = element.dataset.isVehicle;
      await this.clockStylePickerPopup(path, themeColor, isVehicleProxy, isVehicle);
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDropItem(event, droppedItem) {
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this actor. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, await Item.implementation.fromDropData(droppedItem));
  }

  /** @override */
  async _onDropActor(event, droppedActor) {
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this actor. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
      return false;
    }
    await this.handleDrop(event, droppedActor);
  }

  /** @override */
  async handleDrop(event, droppedEntity) {
    const droppedEntityFull = BladesHelpers.resolveActor(droppedEntity.uuid);
    await this.handleAddedObjects([droppedEntityFull]);
  }

  async handleAddedObjects(droppedEntitiesFull) {}

  /* -------------------------------------------- */

  async onItemAddClick(event) {
    const target = event.currentTarget;
    event.preventDefault();
    const itemTypes = target.dataset.itemType.split(',');
    const valuePath = target.dataset.valuePath;
    const unique = target.dataset.unique;
    const addAsItem = target.dataset.addAsItem;
    const containerId = target.dataset.containerId;
    const inputType = unique !== undefined ? 'radio' : 'checkbox';

    const itemElement = target.closest('.item-with-container').querySelector('.item');
    if (itemElement) {
      const [_, item] = this.actor.getItemOwner(itemElement.dataset.itemId);
      if (item.system.suppressed) {
        ui.notifications.warn(game.i18n.localize('BITD.log.warn.NoAddFromSuppressedContainer'));
        return;
      }
    }

    const items = await BladesHelpers.getAllObjectDocumentsByType(itemTypes, [], game);
    var title = '';
    for (const itemType of itemTypes)
      title += game.i18n.localize(`TYPES.Item.${itemType}`) + (itemTypes[itemTypes.length - 1] != itemType ? ' / ' : '');
    if (items.length == 0) {
      ui.notifications.warn(game.i18n.localize('BITD.log.warn.NothingToAdd'));
      return;
    }
    const dialogId = foundry.applications.api.ApplicationV2._appId + 1;
    var html = `<input id="${dialogId}-search-bar" type="text" value="" placeholder="${game.i18n.format('BITD.SearchBar', { obj: title })}" autofocus>`;
    html += `<div class="objects-to-add">`;
    items.forEach(e => {
      var additionPriceLoad = ``;
      if (typeof e.system.load !== 'undefined') additionPriceLoad += `(${e.system.load})`
      else if (typeof e.system.price !== 'undefined') additionPriceLoad += `(${e.system.price})`

      html += `<input id="${dialogId}-select-item-${e._id}" name="select_items" type="${inputType}" value="${e._id}">`;
      html += `<label class="entry" for="${dialogId}-select-item-${e._id}">`;
      html += `${game.i18n.localize(e.name)} ${additionPriceLoad} <i class="fas fa-question-circle" data-tooltip="${game.i18n.localize(e.system.description)}"></i>`;
      html += `</label>`;
    });

    html += `</div>`;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('Add')} ${title}` },
      content: html,
      buttons: [
        {
          icon: 'fas fa-check',
          label: game.i18n.localize('Add'),
          action: 'add',
          default: true
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel'
        }
      ],
      submit: async (result, dialog) => {
        if (result == 'add')
          for (const itemType of itemTypes)
            await this.addItemsToSheetFromDialog(itemType, $(dialog.element).find('.objects-to-add'), valuePath, addAsItem, containerId);
      }
    });

    dialog._onFirstRender = this.dialogOnFirstRender;
    dialog.render(true);
  }

  async onActorAddClick(event) {
    event.preventDefault();
    var actorTypes = $(event.currentTarget).data('actorType');
    var valuePaths = $(event.currentTarget).data('valuePath');
    const parentPath = $(event.currentTarget).data('parentPath');
    const unique = $(event.currentTarget).data('unique');
    var title = $(event.currentTarget).data('title');

    const inputType = unique !== undefined ? 'radio' : 'checkbox';

    if (actorTypes) actorTypes = actorTypes.split(',');
    if (valuePaths) valuePaths = valuePaths.split(',');

    var exclusionList = [];
    if (unique === undefined && valuePaths)
      for (const valuePath of valuePaths) {
        exclusionList = BladesHelpers.getNestedProperty(this.actor, valuePath);
        exclusionList = Object.values(exclusionList).map(e => e.uuid);
      }

    if (!title) {
      title = '';
      for (const actorType of actorTypes)
        title += game.i18n.localize(`TYPES.Actor.${actorType}`) + (actorTypes[actorTypes.length - 1] != actorType ? ' / ' : '');
    }

    const dialogId = foundry.applications.api.ApplicationV2._appId + 1;
    var actors = [];
    if (actorTypes && actorTypes[0] == 'crewmate') {
      actorTypes = ['character', 'npc'];
      const squadFull = BladesHelpers.resolveActor(this.actor.system.crew);
      if (!squadFull) {
        ui.notifications.warn(game.i18n.localize('BITD.log.warn.NoSquadToAddConnection'));
        return;
      }
      actors = BladesHelpers.fetchSimpleData(Object.values(squadFull.system.members).filter(m => m.uuid != this.actor.uuid && !Object.values(this.actor.system.connections).map(c => c.uuid).includes(m.uuid)), [], BladesHelpers._simpleCompareFunc);
    } else
      for (const actorType of actorTypes)
        actors = actors.concat(await BladesHelpers.getAllObjectDocumentsByType(actorType, exclusionList, game));
    if (actors.length == 0) {
      ui.notifications.warn(game.i18n.localize('BITD.log.warn.NothingToAdd'));
      return;
    }
    var html = `<input id="${dialogId}-search-bar" type="text" value="" placeholder="${game.i18n.format('BITD.SearchBar', {obj: title})}" autofocus>`
    html += `<div class="objects-to-add">`;

    for (const actor of actors) {
      html += `<input id="${dialogId}-select-actor-${actor._id}" name="select_actors" type="${inputType}" value="${actor._id}">`;
      html += `<label class="entry" for="${dialogId}-select-actor-${actor._id}">`;
      // Try to fetch known parent if it exists
      var parentName = ``;
      var parentValue = undefined;
      if (parentPath) {
        parentValue = BladesHelpers.getNestedProperty(actor, parentPath);
        if (parentValue) parentValue = BladesHelpers.resolveActor(parentValue);
        if (parentValue) parentName = `(${game.i18n.localize(parentValue.name)})`;
      }
      html += `${game.i18n.localize(actor.name)} ${parentName}`;
      html += `</label>`;
    }

    html += `</div>`;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('Add')} ${title}` },
      content: html,
      buttons: [
        {
          icon: 'fas fa-check',
          label: game.i18n.localize('Add'),
          action: 'add',
          default: true
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel'
        }
      ],
      submit: async (result, dialog) => {
        if (result == 'add')
          await this.addActorsToSheet(actorTypes, $(dialog.element).find('.objects-to-add'));
      }
    });

    dialog._onFirstRender = this.dialogOnFirstRender;
    dialog.render(true);
  }

  dialogOnFirstRender(context, options) {
    const searchBar = this.element.querySelector('input[type=text]');
    searchBar.addEventListener('input', (event) => {
      const labels = this.element.querySelector('.objects-to-add').getElementsByClassName('entry');
      for (const label of labels)
        label.style.display = label.innerText.toLowerCase().includes(event.target.value.toLowerCase()) ? 'block' : 'none';
    });

    const scroll = this.element.querySelector('.window-content');
    scroll.scrollTop = 0;
  }

  /* -------------------------------------------- */

  async addItemsToSheetFromDialog(itemType, el, valuePath, addAsItem, containerId) {
    const items = await BladesHelpers.getAllObjectDocumentsByType(itemType, [], game);
    const itemsToAdd = [];
    el.find('input:checked').each(function() {
      const item = items.find(e => e._id === $(this).val());
      if (item)
        itemsToAdd.push(items.find(e => e._id === $(this).val()));
    });

    await this.addItemsToSheet(itemsToAdd, valuePath, addAsItem, containerId, {});
  }

  async addItemsToSheet(itemsToAdd, valuePath, addAsItem, containerId, extraModifiers) {
    if (!valuePath) {
      const ownerFull = this.actor.getGeneralVehicleGearOwner();
      const items = await BladesHelpers.tryCreate(itemsToAdd, ownerFull);
      for (const item of items) {
        if (containerId)
          await BladesHelpers.tryUpdate(item, {'system.==owner': containerId});
        if (item?.system?.uses?.value != undefined)
          await BladesHelpers.tryUpdate(item, {'system.uses.==value': item.system.uses.max});
        if (extraModifiers)
          await BladesHelpers.tryUpdate(item, extraModifiers);
      }
      if (ownerFull != this.actor)
        // Update sheet for everyone
        await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});
    } else if (addAsItem)
      await this.handleAddedObjects(itemsToAdd, false);
    else
      await this.addItemAsReference(itemsToAdd[0], valuePath);
  }

  async addItemAsObjectAndStoreReference(itemToAdd, valuePath) {
    const itemFull = (await BladesHelpers.tryCreate([itemToAdd], this.document))[0];
    if (!itemFull)
      return;
    if (itemFull.system.uses)
      await BladesHelpers.tryUpdate(itemFull, {'system.uses.==value': itemFull.system.uses.max});
    const updateObject = BladesHelpers.createUpdateObjectFromPath(itemFull._id, valuePath);
    // Fetch object and delete it if it exists
    var objectToDelete = this.actor;
    for (const pathPart of valuePath.split('.')) {
      if (!objectToDelete)
        break;
      objectToDelete = objectToDelete[pathPart];
    }
    if (typeof objectToDelete != 'undefined' && this.actor.items.find(i => i._id == objectToDelete))
      await this.actor.removeItem(await BladesHelpers.getOwnedItem(this.actor, objectToDelete));
    await BladesHelpers.tryUpdate(this.actor, updateObject);
  }

  async addItemAsReference(itemToAdd, valuePath) {
    if (!itemToAdd)
      return;
    itemToAdd = { name: itemToAdd.name, id: itemToAdd.id, img: itemToAdd.img, system: foundry.utils.deepClone(itemToAdd.system) };
    const updateObject = BladesHelpers.createUpdateObjectFromPath(itemToAdd, valuePath);
    await BladesHelpers.tryUpdate(this.actor, updateObject);
  }

  async addActorsToSheet(actorTypes, el) {
    const actors = await BladesHelpers.getAllObjectDocumentsByType(actorTypes, [], game);
    const actorsToAdd = [];
    el.find('input:checked').each(function() {
      actorsToAdd.push(actors.find(e => e._id === $(this).val()));
    });

    await this.actor.sheet.handleAddedObjects(actorsToAdd, false);
  }

  /* -------------------------------------------- */

  /**
   * Roll an Attribute die.
   * @param {*} event
   */
  async onRollAttributeDieClick(event) {
    const attributeName = $(event.currentTarget).data('rollAttribute');
    await this.actor.rollAttributePopup(attributeName);
  }

  /* -------------------------------------------- */

  async onUpdateBoxClick(event) {
    event.preventDefault();
    const itemId = $(event.currentTarget).data('item');
    var updateValue = $(event.currentTarget).data('value');
    const updateType = $(event.currentTarget).data('utype');
    if (updateValue === undefined)
      updateValue = document.getElementById('fac-' + updateType + '-' + itemId).value;
    var update;
    if (updateType === 'status')
      update = {_id: itemId, system: {status: {value: updateValue}}};
    else if (updateType == 'hold')
      update = {_id: itemId, system: {hold: {value: updateValue}}};
    else {
      console.log('update attempted for type undefined in blades-sheet.js onUpdateBoxClick function');
      return;
    };

    await this.actor.updateEmbeddedDocuments('Item', [update]);
  }

  /* -------------------------------------------- */

  async onRadioMiddleClick(event) {
    var type = event.target.tagName.toLowerCase();
    const element = event.target;
    var target = type == 'label' ? element : element.parentElement;
    const label = target;
    type = target.tagName.toLowerCase();
    if (type == 'label')
      target = label.previousElementSibling;

    var actor = this.actor;
    const isVehicle = actor.type == 'vehicle';
    if (actor.system.vehicle)
      actor = BladesHelpers.resolveActor(actor.system.vehicle);
    if (!actor) return;

    const value = parseInt(target.value);
    const fieldList = (isVehicle ? target.name : $(target).data('name')).split('.');
    const attributeName = fieldList[2];
    const actionName = fieldList[4];
    const actionData = (await this.getData()).system.attributes[attributeName].actions[actionName];
    const oldFormField = actionData.first_form != 0 ? 'first_form' : actionData.second_form != 0 ? 'second_form' : '';
    const formField = oldFormField == 'first_form' ? 'second_form' : oldFormField == 'second_form' ? '' : 'first_form';
    const updateObject = {};
    if (formField) updateObject[`system.attributes.${attributeName}.actions.${actionName}.==${formField}`] = value - actionData.value;
    if (oldFormField) updateObject[`system.attributes.${attributeName}.actions.${actionName}.==${oldFormField}`] = 0;
    if (Object.keys(updateObject).length > 0) {
      await BladesHelpers.tryUpdate(actor, updateObject);
      const pilotFull = BladesHelpers.resolveActor(actor.system.pilot);
      if (pilotFull)
        await BladesHelpers.tryUpdate(pilotFull, {'==name': pilotFull.name});
    }
  }

  /* -------------------------------------------- */

  /**
   * Call a popup for changing a clock's theme and color.
   */
  async clockStylePickerPopup(path, themeColor, isVehicleProxy, isVehicle) {
    const defaultThemeColor = game.settings.get('beamsaber', 'DefaultClockThemeColor');

    const clockStylesDropdown = { 'null': `${defaultThemeColor} (default)` };
    for (const [themeName, theme] of Object.entries(BladesHelpers.clockStyles))
      if (themeName != 'dataReason')
        for (const [colorName, color] of Object.entries(theme))
          if (colorName != 'dataReason')
            clockStylesDropdown[`${themeName}/${colorName}`] = `${themeName}/${colorName}`;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('BITD.ClockStylePicker')}` },
      content: await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/popups/clock-style-picker.html', { clockStylesDropdown: clockStylesDropdown, themeColor: themeColor }),
      classes: ['clock-style-picker'],
      buttons: [
        {
          icon: 'fas fa-save',
          label: game.i18n.localize('SETTINGS.Save'),
          action: 'save',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('BITD.Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'save') return;

        const value = dialog.element.querySelector('select').value;
        const updateObject = {};
        var updatePath = path.split('.');
        updatePath[updatePath.length - 1] = '==' + updatePath[updatePath.length - 1];
        updatePath = updatePath.join('.');
        updateObject[updatePath] = value;
        await BladesHelpers.tryUpdate(isVehicleProxy ? BladesHelpers.resolveActor(this.actor.system.vehicle) : this.actor, updateObject);
        if (isVehicleProxy)
          await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});

        const refreshPilot = async (a) => {
          if (a)
            setTimeout(refreshPilot, 200);
          if (this.actor.system.pilot) {
            const pilotFull = BladesHelpers.resolveActor(this.actor.system.pilot);
            if (pilotFull)
              await BladesHelpers.tryUpdate(pilotFull, {'==name': pilotFull.name});
          }
        }
        if (isVehicle)
          refreshPilot(1);
      }
    });
    await dialog.render(true);
  }
}

const { HandlebarsApplicationMixin } = foundry.applications.api
const { ActorSheetV2 } = foundry.applications.sheets

export class BladesSheetV2 extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    actions: {
      itemAddPopup: this.#onItemAddClick,
      actorAddPopup: this.#onActorAddClick,
      updateBox: this.#onUpdateBoxClick,
      radioToggle: this.#radioToggle, // 'label.radio-toggle'
      itemPost: this.#itemPost,
      rollDieAttribute: this.#rollDieAttribute,
      itemBody: this.#itemBody,
      deleteItem: this.#deleteItem,
      addProject: this.#addProject,
      deleteProject: this.#deleteProject,
      openActor: this.#openActor,
      trustBlock: this.#trustBlock, // '.trust-block label.input'
      statusBlock: this.#statusBlock, // '.status-block label.input'
      deleteRelationship: this.#deleteRelationship, // '.delete-relationship:not(.disabled-item)'
      deathToggle: this.#deathToggle,
      effectControl: this.#effectControl,
    }
  };

  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    html.find('label.radio-toggle').contextmenu((e) => {
      BladesHelpers.onRadioToggle(e);
      e.preventDefault();
    });
    html.find('label.radio-toggle.middle').mousedown((e) => {
      // Middle click
      if (e && (e.which == 2 || e.button == 1)) {
        this.onRadioMiddleClick(e);
        e.preventDefault();
      }
    });

    // This is a workaround until is being fixed in FoundryVTT.
    //if (this.options.submitOnChange)
    //  html.on('change', 'textarea', this._onChangeInput.bind(this));  // Use delegated listener on the form
  }

  /* -------------------------------------------- */

  static async #onItemAddClick(event, target) {
    event.preventDefault();
    const itemTypes = target.dataset.itemType.split(',');
    const valuePath = target.dataset.valuePath;
    const unique = target.dataset.unique;
    const addAsItem = target.dataset.addAsItem;
    const containerId = target.dataset.containerId;
    const inputType = unique !== undefined ? 'radio' : 'checkbox';

    const itemElement = target.closest('.item-with-container').querySelector('.item');
    if (itemElement) {
      const [_, item] = this.actor.getItemOwner(itemElement.dataset.itemId);
      if (item.system.suppressed) {
        ui.notifications.warn(game.i18n.localize('BITD.log.warn.NoAddFromSuppressedContainer'));
        return;
      }
    }

    const items = await BladesHelpers.getAllObjectDocumentsByType(itemTypes, [], game);
    var title = '';
    for (const itemType of itemTypes)
      title += game.i18n.localize(`TYPES.Item.${itemType}`) + (itemTypes[itemTypes.length - 1] != itemType ? ' / ' : '');
    if (items.length == 0) {
      ui.notifications.warn(game.i18n.localize('BITD.log.warn.NothingToAdd'));
      return;
    }
    const dialogId = foundry.applications.api.ApplicationV2._appId + 1;
    var html = `<input id="${dialogId}-search-bar" type="text" value="" placeholder="${game.i18n.format('BITD.SearchBar', { obj: title })}" autofocus>`;
    html += `<div class="objects-to-add">`;
    items.forEach(e => {
      var additionPriceLoad = ``;
      if (typeof e.system.load !== 'undefined') additionPriceLoad += `(${e.system.load})`
      else if (typeof e.system.price !== 'undefined') additionPriceLoad += `(${e.system.price})`

      html += `<input id="${dialogId}-select-item-${e._id}" name="select_items" type="${inputType}" value="${e._id}">`;
      html += `<label class="entry" for="${dialogId}-select-item-${e._id}">`;
      html += `${game.i18n.localize(e.name)} ${additionPriceLoad} <i class="fas fa-question-circle" data-tooltip="${game.i18n.localize(e.system.description)}"></i>`;
      html += `</label>`;
    });

    html += `</div>`;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('Add')} ${title}` },
      content: html,
      buttons: [
        {
          icon: 'fas fa-check',
          label: game.i18n.localize('Add'),
          action: 'add',
          default: true
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel'
        }
      ],
      submit: async (result, dialog) => {
        if (result == 'add')
          for (const itemType of itemTypes)
            await this.addItemsToSheetFromDialog(itemType, $(dialog.element).find('.objects-to-add'), valuePath, addAsItem, containerId);
      }
    });

    dialog._onFirstRender = this.dialogOnFirstRender;
    dialog.render(true);
  }

  static async #onActorAddClick(event, target) {
    event.preventDefault();
    var actorTypes = target.dataset.actorType;
    var valuePaths = target.dataset.valuePath;
    const parentPath = target.dataset.parentPath;
    const unique = target.dataset.unique;
    var title = target.dataset.title;

    const inputType = unique !== undefined ? 'radio' : 'checkbox';

    if (actorTypes) actorTypes = actorTypes.split(',');
    if (valuePaths) valuePaths = valuePaths.split(',');

    var exclusionList = [];
    if (unique === undefined && valuePaths)
      for (const valuePath of valuePaths) {
        exclusionList = BladesHelpers.getNestedProperty(this.actor, valuePath);
        exclusionList = Object.values(exclusionList).map(e => e.uuid);
      }

    if (!title) {
      title = '';
      for (const actorType of actorTypes)
        title += game.i18n.localize(`TYPES.Actor.${actorType}`) + (actorTypes[actorTypes.length - 1] != actorType ? ' / ' : '');
    }

    const dialogId = foundry.applications.api.ApplicationV2._appId + 1;
    const actors = [];
    if (actorTypes && actorTypes[0] == 'crewmate') {
      actorTypes = ['character', 'npc'];
      const squadFull = BladesHelpers.resolveActor(this.actor.system.crew);
      if (!squadFull) {
        ui.notifications.warn(game.i18n.localize('BITD.log.warn.NoSquadToAddConnection'));
        return;
      }
      actors = BladesHelpers.fetchSimpleData(Object.values(squadFull.system.members).filter(m => m.uuid != this.actor.uuid && !Object.values(this.actor.system.connections).map(c => c.uuid).includes(m.uuid)), [], BladesHelpers._simpleCompareFunc);
    } else
      for (const actorType of actorTypes)
        actors = actors.concat(await BladesHelpers.getAllObjectDocumentsByType(actorType, exclusionList, game));
    if (actors.length == 0) {
      ui.notifications.warn(game.i18n.localize('BITD.log.warn.NothingToAdd'));
      return;
    }
    var html = `<input id="${dialogId}-search-bar" type="text" value="" placeholder="${game.i18n.format('BITD.SearchBar', {obj: title})}" autofocus>`
    html += `<div class="objects-to-add">`;

    for (const actor of actors) {
      html += `<input id="${dialogId}-select-actor-${actor._id}" name="select_actors" type="${inputType}" value="${actor._id}">`;
      html += `<label class="entry" for="${dialogId}-select-actor-${actor._id}">`;
      // Try to fetch known parent if it exists
      var parentName = ``;
      var parentValue = undefined;
      if (parentPath) {
        parentValue = BladesHelpers.getNestedProperty(actor, parentPath);
        if (parentValue) parentValue = BladesHelpers.resolveActor(parentValue);
        if (parentValue) parentName = `(${game.i18n.localize(parentValue.name)})`;
      }
      html += `${game.i18n.localize(actor.name)} ${parentName}`;
      html += `</label>`;
    }

    html += `</div>`;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('Add')} ${title}` },
      content: html,
      buttons: [
        {
          icon: 'fas fa-check',
          label: game.i18n.localize('Add'),
          action: 'add',
          default: true
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('Cancel'),
          action: 'cancel'
        }
      ],
      submit: async (result, dialog) => {
        if (result == 'add')
          await this.addActorsToSheet(actorTypes, $(dialog.element).find('.objects-to-add'));
      }
    });

    dialog._onFirstRender = this.dialogOnFirstRender;
    dialog.render(true);
  }

  static async #onUpdateBoxClick(event, target) {
    event.preventDefault();
    const itemId = target.dataset.item;
    var updateValue = target.dataset.value;
    const updateType = target.dataset.utype;
    if (updateValue === undefined)
      updateValue = document.getElementById('fac-' + updateType + '-' + itemId).value;
    var update;
    if (updateType === 'status')
      update = {_id: itemId, system: {status: {value: updateValue}}};
    else if (updateType == 'hold')
      update = {_id: itemId, system: {hold: {value: updateValue}}};
    else {
      console.log('update attempted for type undefined in blades-sheet.js onUpdateBoxClick function');
      return;
    };

    await this.actor.updateEmbeddedDocuments('Item', [update]);
  }

  static async #radioToggle(event, target) {
    event.preventDefault();
    BladesHelpers.onRadioToggle(event);
  }

  // Post item to chat
  static async #itemPost(event, target) {
    const element = target.closest('.item');
    const item = this.actor.items.get(element.dataset.itemId);
    item.sendToChat();
  }

  // Roll an Attribute die
  static async #rollDieAttribute(event, target) {
    const attributeName = target.dataset.rollAttribute;
    await this.actor.rollAttributePopup(attributeName);
  }

  // Update Inventory Item
  static async #itemBody(event, target) {
    const element = target.closest('.item');
    const item = this.actor.items.get(element.dataset.itemId);
    if (!item && this.actor.type == 'vehicle') {
      ui.notifications.warn(game.i18n.localize('BITD.log.warn.NotItemOwnerVehicle'));
      return;
    }
    item.sheet.render(true);
  }

  // Delete Inventory Item
  static async #deleteItem(event, target) {
    var element = target.closest('.item');
    const item = this.actor.items.get(element.dataset.itemId);
    if (element.parentElement.classList.contains('item-with-container'))
      element = element.parentElement;
    await this.actor.removeItem(item);
    // TODO: Slide up animation 200ms: element.slideUp(200, async () => await this.actor.removeItem(item));
  }

  // Add Project
  static async #addProject(event, target) {
    const projects = this.actor.system.projects;
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
    await BladesHelpers.tryUpdate(this.actor, {'system.==projects': projects});
  }

  // Delete Project
  static async #deleteProject(event, target) {
    const element = target.closest('.item');
    const currentProjectId = element.dataset.projectId;
    const projectsEntries = Object.entries(this.actor.system.projects);
    projectsEntries.splice(currentProjectId, 1);
    for (const id in projectsEntries)
      projectsEntries[id][0] = String(id);
    await BladesHelpers.tryUpdate(this.actor, {'system.==projects': Object.fromEntries(projectsEntries)});
    // TODO: Slide up animation 200ms: element.slideUp(200, async () => await BladesHelpers.tryUpdate(this.actor, {'system.==projects': Object.fromEntries(projectsEntries)}));
  }

  // Open Actor
  static async #openActor(event, target) {
    const element = target.closest('.item');
    const actorId = element.dataset.itemId;
    const actorFull = BladesHelpers.resolveActor(actorId);
    actorFull?.sheet.render(true);
  }

  // Update Trust
  static async #trustBlock(event, target) {
    const element = target.closest(".item");
    const entityFull = BladesHelpers.resolveActor(element.dataset.itemId);
    if (entityFull)
      await BladesHelpers.handleRelationshipValue(this.actor, entityFull, 'trust', target.dataset.value, true);
  }

  // Update Relationship Status
  static async #statusBlock(event, target) {
    const element = target.closest(".item");
    const entityFull = BladesHelpers.resolveActor(element.dataset.itemId);
    if (entityFull)
      await BladesHelpers.handleRelationshipValue(this.actor, entityFull, 'status', $(ev.currentTarget).dataset.value, true);
  }

  // Delete Relationship
  static async #deleteRelationship(event, target) {
    const element = target.closest(".item");
    const entityFull = BladesHelpers.resolveActor(element.dataset.itemId);
    if (entityFull)
      BladesHelpers.removeRelationship(this.actor, entityFull);
  }

  static async #deathToggle(event, target) {
    const targetId = target.dataset.targetId ?? this.actor.uuid;
    const targetFull = BladesHelpers.resolveActor(targetId);
    await BladesHelpers.tryUpdate(targetFull, {'system.==dead': !targetFull.system.dead});
    const pilotFull = BladesHelpers.resolveActor(targetFull.system.pilot);
    if (pilotFull)
      await BladesHelpers.tryUpdate(pilotFull, {'==name': pilotFull.name});
  }

  // mMnage active effects
  static async #effectControl(event, target) { BladesActiveEffect.onManageActiveEffect(ev, this.actor); }

  static async #clockStylePicker(event, target) {
    const path = target.dataset.path;
    const themeColor = target.dataset.themeColor;
    const isVehicleProxy = target.dataset.isVehicleProxy;
    const isVehicle = target.dataset.isVehicle;
    await this.clockStylePickerPopup(path, themeColor, isVehicleProxy, isVehicle);
  }

  /* -------------------------------------------- */

  dialogOnFirstRender(context, options) {
    const searchBar = this.element.querySelector('input[type=text]');
    searchBar.addEventListener('input', (event) => {
      const labels = this.element.querySelector('.objects-to-add').getElementsByClassName('entry');
      for (const label of labels)
        label.style.display = label.innerText.toLowerCase().includes(event.target.value.toLowerCase()) ? 'block' : 'none';
    });

    const scroll = this.element.querySelector('.window-content');
    scroll.scrollTop = 0;
  }

  /* -------------------------------------------- */

  async addItemsToSheetFromDialog(itemType, el, valuePath, addAsItem, containerId) {
    const items = await BladesHelpers.getAllObjectDocumentsByType(itemType, [], game);
    const itemsToAdd = [];
    el.find('input:checked').each(function() {
      const item = items.find(e => e._id === $(this).val());
      if (item)
        itemsToAdd.push(items.find(e => e._id === $(this).val()));
    });

    await this.addItemsToSheet(itemsToAdd, valuePath, addAsItem, containerId, {});
  }

  async addItemsToSheet(itemsToAdd, valuePath, addAsItem, containerId, extraModifiers) {
    if (!valuePath) {
      const owner = this.actor.getGeneralVehicleGearOwner();
      const items = await BladesHelpers.tryCreate(itemsToAdd, owner);
      for (const item of items) {
        if (containerId)
          await BladesHelpers.tryUpdate(item, {'system.==owner': containerId});
        if (item?.system?.uses?.value != undefined)
          await BladesHelpers.tryUpdate(item, {'system.uses.==value': item.system.uses.max});
        if (extraModifiers)
          await BladesHelpers.tryUpdate(item, extraModifiers);
      }
      if (owner != this.actor)
        // Update sheet for everyone
        await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});
    } else if (addAsItem && itemsToAdd.length)
      await this.addItemAsObjectAndStoreReference(itemsToAdd[0], valuePath);
    await this.actor.sheet.handleAddedObjects(itemsToAdd, false);
  }

  async addItemAsObjectAndStoreReference(itemToAdd, valuePath) {
    const itemFull = (await BladesHelpers.tryCreate([itemToAdd], this.document))[0];
    if (!itemFull)
      return;
    if (itemFull.system.uses)
      await BladesHelpers.tryUpdate(itemFull, {'system.uses.==value': itemFull.system.uses.max});
    const updateObject = BladesHelpers.createUpdateObjectFromPath(itemFull._id, valuePath);
    // Fetch object and delete it if it exists
    var objectToDelete = this.actor;
    for (const pathPart of valuePath.split('.')) {
      if (!objectToDelete)
        break;
      objectToDelete = objectToDelete[pathPart];
    }
    if (typeof objectToDelete != 'undefined' && this.actor.items.find(i => i._id == objectToDelete))
      await this.actor.removeItem(await BladesHelpers.getOwnedItem(this.actor, objectToDelete));
    await BladesHelpers.tryUpdate(this.actor, updateObject);
  }

  async addActorsToSheet(actorTypes, el) {
    const actors = await BladesHelpers.getAllObjectDocumentsByType(actorTypes, [], game);
    const actorsToAdd = [];
    el.find('input:checked').each(function() {
      actorsToAdd.push(actors.find(e => e._id === $(this).val()));
    });

    await this.handleAddedObjects(actorsToAdd, false);
  }

  /* -------------------------------------------- */

  async onRadioMiddleClick(event) {
    var type = event.target.tagName.toLowerCase();
    const element = event.target;
    var target = type == 'label' ? element : element.parentElement;
    const label = target;
    type = target.tagName.toLowerCase();
    if (type == 'label')
      target = label.previousElementSibling;

    var actor = this.actor;
    const isVehicle = actor.type == 'vehicle';
    if (actor.system.vehicle)
      actor = BladesHelpers.resolveActor(actor.system.vehicle);
    if (!actor) return;

    const value = parseInt(target.value);
    const fieldList = (isVehicle ? target.name : target.dataset.name).split('.');
    const attributeName = fieldList[2];
    const actionName = fieldList[4];
    const actionData = (await this._prepareContext()).system.attributes[attributeName].actions[actionName];
    const oldFormField = actionData.first_form != 0 ? 'first_form' : actionData.second_form != 0 ? 'second_form' : '';
    const formField = oldFormField == 'first_form' ? 'second_form' : oldFormField == 'second_form' ? '' : 'first_form';
    const updateObject = {};
    if (formField) updateObject[`system.attributes.${attributeName}.actions.${actionName}.==${formField}`] = value - actionData.value;
    if (oldFormField) updateObject[`system.attributes.${attributeName}.actions.${actionName}.==${oldFormField}`] = 0;
    if (Object.keys(updateObject).length > 0) {
      await BladesHelpers.tryUpdate(actor, updateObject);
      const pilotFull = BladesHelpers.resolveActor(actor.system.pilot);
      if (pilotFull)
        await BladesHelpers.tryUpdate(pilotFull, {'==name': pilotFull.name});
    }
  }

  /* -------------------------------------------- */

  /**
   * Call a popup for changing a clock's theme and color.
   */
  async clockStylePickerPopup(path, themeColor, isVehicleProxy, isVehicle) {
    const defaultThemeColor = game.settings.get('beamsaber', 'DefaultClockThemeColor');

    const clockStylesDropdown = { 'null': `${defaultThemeColor} (default)` };
    for (const [themeName, theme] of Object.entries(BladesHelpers.clockStyles))
      if (themeName != 'dataReason')
        for (const [colorName, color] of Object.entries(theme))
          if (colorName != 'dataReason')
            clockStylesDropdown[`${themeName}/${colorName}`] = `${themeName}/${colorName}`;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `${game.i18n.localize('BITD.ClockStylePicker')}` },
      content: await foundry.applications.handlebars.renderTemplate('systems/beamsaber/templates/popups/clock-style-picker.html', { clockStylesDropdown: clockStylesDropdown, themeColor: themeColor }),
      classes: ['clock-style-picker'],
      buttons: [
        {
          icon: 'fas fa-save',
          label: game.i18n.localize('SETTINGS.Save'),
          action: 'save',
        },
        {
          icon: 'fas fa-times',
          label: game.i18n.localize('BITD.Cancel'),
          action: 'cancel',
        }
      ],
      submit: async (result, dialog) => {
        if (result != 'save') return;

        const value = dialog.element.querySelector('select').value;
        const updateObject = {};
        var updatePath = path.split('.');
        updatePath[updatePath.length - 1] = '==' + updatePath[updatePath.length - 1];
        updatePath = updatePath.join('.');
        updateObject[updatePath] = value;
        await BladesHelpers.tryUpdate(isVehicleProxy ? BladesHelpers.resolveActor(this.actor.system.vehicle) : this.actor, updateObject);
        if (isVehicleProxy)
          await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});

        const refreshPilot = async (a) => {
          if (a)
            setTimeout(refreshPilot, 200);
          if (this.actor.system.pilot) {
            const pilotFull = BladesHelpers.resolveActor(this.actor.system.pilot);
            if (pilotFull)
              await BladesHelpers.tryUpdate(pilotFull, {'==name': pilotFull.name});
          }
        }
        if (isVehicle)
          refreshPilot(1);
      }
    });
    await dialog.render(true);
  }
}