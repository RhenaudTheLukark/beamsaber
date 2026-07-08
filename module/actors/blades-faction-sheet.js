
import { BladesHelpers } from '../blades-helpers.js';
import { BladesSheet } from '../blades-sheet.js';

/**
 * @extends {BladesSheet}
 */
export class BladesFactionSheet extends BladesSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['beamsaber', 'sheet', 'actor', 'faction'],
      template: 'systems/beamsaber/templates/actors/faction-sheet.html',
      width: 550,
      height: 'auto',
      tabs: [{navSelector: '.tabs', contentSelector: '.tab-content'}]
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

    sheetData.system.type = BladesHelpers.getOwnedItem(this.actor, sheetData.system.type);

    // Fetch squads, regions and npcs
    sheetData.system.squads = BladesHelpers.fetchSimpleData(sheetData.system.squads, ['status', 'trust'], BladesHelpers._factionSquadCompareFunc);
    sheetData.system.regions = BladesHelpers.fetchSimpleData(sheetData.system.regions, ['status'], BladesHelpers._simpleCompareFunc);
    sheetData.system.npcs = BladesHelpers.fetchSimpleData(sheetData.system.npcs, [], BladesHelpers._simpleCompareFunc);

    // Fetch relationships data and direct relationships
    [sheetData.system.relationships, sheetData.system.direct_relationships] = BladesHelpers.fetchFullAndRelativeRelationshipsData(this.actor, sheetData.system.relationships);

    sheetData.defaultClockThemeColor = game.settings.get('beamsaber', 'DefaultClockThemeColor');

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
    let currentTab = this._tabs[0].active;
    for (let droppedEntityFull of droppedEntitiesFull) {
      if (!droppedEntityFull || droppedEntityFull.uuid == this.actor.uuid)
        continue;

      switch (currentTab) {
        case "relationships":
          if (["faction", "crew", "character", "npc"].includes(droppedEntityFull.type))
            await BladesHelpers.addRelationship(this.actor, droppedEntityFull);
          break;
        case "squads":
          if (droppedEntityFull.type == "crew")
            await BladesHelpers.addFactionSquad(this.actor, droppedEntityFull, true);
          break;
        case "npcs":
          if (droppedEntityFull.type == "npc")
            await BladesHelpers.addFactionNPC(this.actor, droppedEntityFull, true);
          break;
        case "regions":
          if (droppedEntityFull.type == "region")
            await BladesHelpers.addRegionOwner(this.actor, droppedEntityFull, true);
          break;
        default:
          break;
      }

      switch (droppedEntityFull.type) {
        case "faction_type":
          await this.addItemAsObjectAndStoreReference(droppedEntityFull, 'system.type');
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

    // Delete Faction Type
    html.find('.delete-faction-type').click(async ev => {
      let element = $(ev.currentTarget).closest('.item');
      let item = this.actor.items.get(element.data('itemId'));
      if (element.parent().hasClass('item-with-container'))
        element = element.parent();
      element.slideUp(200, async () => {
        await this.actor.removeItem(item);
        await BladesHelpers.tryUpdate(this.actor, {'system.type': null});
      });
    });

    // Delete Squad
    html.find('.delete-squad').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let squadFull = BladesHelpers.resolveActor(element.data("itemId"));
      if (squadFull)
        await BladesHelpers.removeFactionSquad(squadFull);
    });

    // Delete Squad
    html.find('.delete-npc').click( async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let npcFull = BladesHelpers.resolveActor(element.data("itemId"));
      if (npcFull)
        await BladesHelpers.removeFactionNPC(npcFull);
    });

    // Delete Region
    html.find('.delete-region').click( async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let regionFull = BladesHelpers.resolveActor(element.data("itemId"));
      if (regionFull)
        await BladesHelpers.removeRegionOwner(regionFull);
    });

    // Add Goal
    html.find('.add-goal').click(async _ => {
      let goals = this.actor.system.goals;
      goals[Object.keys(goals).length] = {
        title: '',
        clock: {
          value: 0,
          max: 4,
          min: 0,
          theme_color: null
        },
        description: ''
      }
      await BladesHelpers.tryUpdate(this.actor, {'system.==goals': goals});
    });

    // Delete Goal
    html.find('.delete-goal').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let currentGoalId = element.data("goalId");
      let goalsEntries = Object.entries(this.actor.system.goals);
      goalsEntries.splice(currentGoalId, 1);
      for (let id in goalsEntries)
        goalsEntries[id][0] = String(id);
      await BladesHelpers.tryUpdate(this.actor, {'system.==goals': Object.fromEntries(goalsEntries)});
    });

    // Collapse children relationship list
    html.find('.collapse').click(async ev => {
      const element = $(ev.currentTarget).closest(".item");
      let relationshipUuid = element.data("itemId");
      let relationships = this.actor.system.relationships;
      let [relationshipId, relationshipFull] = Object.entries(relationships).find(r => r[1].uuid == relationshipUuid) ?? [-1, null];
      if (relationshipId == -1) return;

      let factionUpdate = {};
      factionUpdate[`system.relationships.${relationshipId}.collapsed`] = !relationshipFull.collapsed;
      let childrenElement = $(element[0].parentElement).children('.relationship-child-list');
      childrenElement.slideToggle(200, async () => await BladesHelpers.tryUpdate(this.actor, factionUpdate));
    });
  }
}
