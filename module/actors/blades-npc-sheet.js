
import { BladesHelpers } from "../blades-helpers.js";
import { BladesSheet } from "../blades-sheet.js";

/**
 * @extends {BladesSheet}
 */
export class BladesNPCSheet extends BladesSheet {

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
  	  classes: ["beamsaber", "sheet", "actor", "npc"],
  	  template: "systems/beamsaber/templates/actors/npc-sheet.html",
      width: 900,
      height: 'auto',
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

    // Fetch region & faction data
    sheetData.system.region = BladesHelpers.resolveActor(sheetData.system.region, { name: "Unknown Region" });
    sheetData.system.faction = BladesHelpers.resolveActor(sheetData.system.faction, { name: "Unknown Faction" });
    sheetData.system.crew = BladesHelpers.resolveActor(sheetData.system.crew, { name: "Unknown Squad" });

    sheetData.system.class = BladesHelpers.getOwnedItem(this.actor, sheetData.system.class);

    //sheetData.system.description = await foundry.applications.ux.TextEditor.enrichHTML(sheetData.system.description, {secrets: sheetData.owner, async: true});

    return sheetData;
  }

  /* -------------------------------------------- */

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
        case 'region':
          await BladesHelpers.addRegionNPC(droppedEntityFull, this.actor, false);
          break;
        case 'faction':
          await BladesHelpers.addFactionNPC(droppedEntityFull, this.actor, false);
          break;
        case 'crew':
          await BladesHelpers.addSquadNPC(droppedEntityFull, this.actor, false);
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

    /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Delete NPC's Class
    html.find('.delete-class').click(async ev => {
      await BladesHelpers.tryUpdate(this.actor, {system: {'==class': null}});
    });

    // Delete NPC's Crew Type
    html.find('.delete-crew').click(async ev => {
      await BladesHelpers.removeSquadNPC(this.actor);
    });

    // Delete NPC's Faction
    html.find('.delete-faction').click(async ev => {
      await BladesHelpers.removeFactionNPC(this.actor);
    });

    // Delete NPC's Region
    html.find('.delete-region').click(async ev => {
      await BladesHelpers.removeNPCRegion(this.actor);
    });
	}
}