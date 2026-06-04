
import { BladesSheet } from "../blades-sheet.js";
import { BladesHelpers } from "../blades-helpers.js";

/**
 * @extends {BladesSheet}
 */
export class BeamVehicleSheet extends BladesSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["beamsaber", "sheet", "actor", "vehicle"],
      template: "systems/beamsaber/templates/actors/vehicle-sheet.html",
      width: 790,
      height: 890,
      tabs: [{navSelector: ".tabs", contentSelector: ".tab-content"}]
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

    // Calculate Load
    sheetData.system.load = BladesHelpers.computeLoad(sheetData, true);

    // Encumbrance levels
    let load_level;
    if (game.settings.get('beamsaber', 'DeepCutLoad'))
      load_level = ["BITD.Discreet", "BITD.Discreet", "BITD.Discreet", "BITD.Discreet", "BITD.Discreet", "BITD.Conspicuous", "BITD.Conspicuous", "BITD.Encumbered",
        "BITD.Encumbered", "BITD.Encumbered", "BITD.OverMax", "BITD.OverMax"];
    else
      load_level = ["BITD.Light", "BITD.Light", "BITD.Light", "BITD.Light", "BITD.Normal", "BITD.Normal", "BITD.Heavy", "BITD.Encumbered",
        "BITD.Encumbered", "BITD.Encumbered", "BITD.OverMax", "BITD.OverMax"];
    sheetData.system.load_level = load_level[sheetData.system.load];

    sheetData.system.faction = BladesHelpers.resolveActor(sheetData.system.faction, { name: "Unknown Faction" });
    sheetData.system.pilot = foundry.utils.deepClone(BladesHelpers.resolveActor(sheetData.system.pilot, { name: "Unknown Pilot" }));
    if (sheetData.system.pilot && sheetData.system.pilot.system.crew)
      sheetData.system.crew = BladesHelpers.resolveActor(sheetData.system.pilot.system.crew, { name: "Unknown Squad" });

    sheetData.defaultClockThemeColor = game.settings.get('beamsaber', 'DefaultClockThemeColor');

    if (game.settings.get('beamsaber', 'DeepCutLoad'))
      sheetData.system.load_levels = { "BITD.Discreet": "BITD.Discreet", "BITD.Conspicuous": "BITD.Conspicuous" };
    else
      sheetData.system.load_levels = { "BITD.Light": "BITD.Light", "BITD.Normal": "BITD.Normal", "BITD.Heavy": "BITD.Heavy" };

    sheetData.specialAmmunitionDropdown = {
      "flak": "BITD.AmmoTypeFlak",
      "armor_piercing": "BITD.AmmoTypeArmorPiercing",
      "incendiary": "BITD.AmmoTypeIncendiary",
      "other": "BITD.AmmoTypeOther",
    }

    sheetData.hackrigTypeDropdown = {
      "tablet": "BITD.HackrigTypeTablet",
      "laptop": "BITD.HackrigTypeLaptop",
      "tower": "BITD.HackrigTypeTower",
      "other": "BITD.HackrigTypeOther"
    }

    sheetData.droneTypeDropdown = {
      "pilot": "BITD.Pilot",
      "vehicle": "BITD.VehicleName"
    }

    // Extra data used in the sheet
    sheetData.gearOwner = sheetData.system.pilot ?? sheetData;
    sheetData.hasActiveAdvancedPrototype = sheetData.gearOwner.items.find(i => i.system.experimental == true) !== undefined;
    sheetData.hasActiveHiddenItem = sheetData.gearOwner.items.find(i => i.system.hidden == true) !== undefined;

    // Update container loads
    for (let container of sheetData.gearOwner.items.filter(i => i.system.is_container)) {
      let [owner, _] = this.actor.getItemOwner(container);
      container.system.container_computed_load = BladesHelpers.computeMaxLoad(owner, container);
      container.system.current_load = BladesHelpers.computeLoad(owner, false, container._id);
      container.system.container_item_types_str = container.system.container_item_types.join(',');
    }

    sheetData.system.attributes = this.actor.getComputedAttributes(true);

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
      ui.notifications.error(`You do not have sufficient permissions to edit this vehicle. Please speak to your GM if you feel you have reached this message in error.`, { permanent: true });
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
        case 'faction':
          await BladesHelpers.addFactionVehicle(droppedEntityFull, this.actor, false);
          break;
        case 'character':
          await BladesHelpers.addCharacterVehicle(droppedEntityFull, this.actor, false);
          break;
        default:
          break;
      }
    }
  }

  /* -------------------------------------------- */

    /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Delete NPC's Class
    html.find('.delete-faction').click(async ev => {
      await BladesHelpers.removeFactionVehicle(this.actor);
    });

    // Add Quirk
    html.find('.add-quirk').click(async _ => {
      let quirks = this.actor.system.quirks;
      quirks[Object.keys(quirks).length] = { name: "", usable: true };
      await BladesHelpers.tryUpdate(this.actor, {system: {'==quirks': quirks}});
    });

    // Delete Quirk
    html.find('.delete-quirk').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentQuirkId = element.data("quirkId");
      let quirksEntries = Object.entries(this.actor.system.quirks);
      quirksEntries.splice(currentQuirkId, 1);
      for (let id in quirksEntries)
        quirksEntries[id][0] = String(id);
      await BladesHelpers.tryUpdate(this.actor, {system: {'==quirks': Object.fromEntries(quirksEntries)}});
    });

    // Update Vehicle Gear Experimental Toggle
    html.find('.experimental > input').change(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentItemId = element.data("itemId");
      let [_, item] = this.actor.getItemOwner(currentItemId);
      await BladesHelpers.tryUpdate(item, {system: {'==experimental': ev.currentTarget.checked}});
      await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});
    });

    // Update Items' Hidden Toggle
    html.find('.hidden-item > input').change(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentItemId = element.data("itemId");
      let [_, item] = this.actor.getItemOwner(currentItemId);
      await BladesHelpers.tryUpdate(item, {system: {'==hidden': ev.currentTarget.checked}});
      await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});
    });

    // Update Item Uses
    html.find('.uses > input').change(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentItemId = element.data("itemId");
      let [_, item] = this.actor.getItemOwner(currentItemId);
      await BladesHelpers.tryUpdate(item, {system: {uses: {'==value': ev.currentTarget.value}}});
      await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});
    });

    // Update Item Description
    html.find('.extra-description > textarea').change(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentItemId = element.data("itemId");
      let [_, item] = this.actor.getItemOwner(currentItemId);
      await BladesHelpers.tryUpdate(item, {system: {'==extra_description': ev.currentTarget.value}});
      await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});
    });

    // Update Hackrig Type
    html.find('.hackrig-type > select').change(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentItemId = element.data("itemId");
      let [_, item] = this.actor.getItemOwner(currentItemId);
      let newHackrigType = ev.currentTarget.value;
      let hackrigLoad = newHackrigType == 'tablet' ? 3 : newHackrigType == 'laptop' ? 5 : newHackrigType == 'tower' ? 6 : item.system.container_load;
      await BladesHelpers.tryUpdate(item, {system: {'==container_type': newHackrigType, '==container_load': hackrigLoad}});
      await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});
    });

    // Update Special Ammunition
    html.find('.ammo > select').change(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentItemId = element.data("itemId");
      let [_, item] = this.actor.getItemOwner(currentItemId);
      const selectedAmmo = ev.currentTarget.value;
      await BladesHelpers.tryUpdate(item, {system: {'==special_ammunition_type': selectedAmmo}});
      await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});
    });

    // Update Drone Item Type
    html.find('.drone-type > select').change(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentItemId = element.data("itemId");
      let [gearOwner, item] = this.actor.getItemOwner(currentItemId);
      let newDroneItemType = ev.currentTarget.value;
      if (newDroneItemType != item.system.container_type)
        for (let containedItem of gearOwner.items.filter(i => i.system.owner == currentItemId))
          await gearOwner.removeItem(containedItem);
      let newContainerItemType = newDroneItemType == 'pilot' ? 'item' : 'vehicle_gear';
      let newContainerLoad = newDroneItemType == 'pilot' ? 2 : 1;
      await BladesHelpers.tryUpdate(item, {system: {'==container_type': newDroneItemType, '==container_load': newContainerLoad, '==container_item_types': [newContainerItemType]}});
      await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});
    });

    // Update Vehicle Gear Form
    html.find('.form-toggle > button').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentItemId = element.data("itemId");
      let [_, item] = this.actor.getItemOwner(currentItemId);
      await BladesHelpers.tryUpdate(item, {system: {'==form': (item.system.form + 1) % 3}});
      await this.actor.updateVehicleForm();
    });

    // Collapse item containers
    html.find('.collapse').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentItemId = element.data("itemId");
      let [_, item] = this.actor.getItemOwner(currentItemId);
      await BladesHelpers.tryUpdate(item, {system: {'==collapsed': !item.system.collapsed}});
      let childrenElement = $(element[0].parentElement).children('.item-container');
      childrenElement.slideToggle(200, async () => await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name}));
    });

    // Delete Inventory Item
    html.find('.delete-vehicle-item').click(async ev => {
      let element = $(ev.currentTarget).closest(".item");
      let currentItemId = element.data("itemId");
      let [gearOwner, item] = this.actor.getItemOwner(currentItemId);
      if (element.parent().hasClass('item-with-container'))
        element = element.parent();
      element.slideUp(200, async () => {
        await gearOwner.removeItem(item);
        await BladesHelpers.tryUpdate(this.actor, {'==name': this.actor.name});
      });
    });

    const vehicleDataHandler = async ev => {
      if (this.actor.system.pilot) {
        let pilotFull = BladesHelpers.resolveActor(this.actor.system.pilot);
        if (pilotFull)
          await BladesHelpers.tryUpdate(pilotFull, {'==name': pilotFull.name});
      }
    };

    html.find('input[type=radio].pilot-shared-data, input[type=checkbox].pilot-shared-data, button.pilot-shared-data').click(vehicleDataHandler);
    html.find('select.pilot-shared-data, input[type=text].pilot-shared-data').change(vehicleDataHandler);
  }
}
