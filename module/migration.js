import { BladesHelpers } from "./blades-helpers.js";

/**
 * Perform a system migration for the entire World, applying migrations for Actors, Items, and Compendium packs
 * @return {Promise}      A Promise which resolves once the migration is completed
 */
export const migrateWorld = async function(oldVersion, newVersion) {
  ui.notifications.info(`Applying Beamsaber Actors migration for version ${game.system.version}. Please be patient and do not close your game or shut down your server.`, {permanent: true});

  // Migrate World Actors
  let actors = foundry.utils.deepClone(game.actors.contents);
  actors.sort(BladesHelpers._relationshipCompareFunc);
  for (let a of actors) {
    try {
      const updateActorData = await _migrateActor(a, oldVersion);
      if (Object.keys(updateActorData).length > 0) {
        console.log(`Migrating ${game.i18n.localize(`TYPES.Actor.${a.type}`)} entity ${a.name}`);
        await BladesHelpers.tryUpdate(a, updateActorData);
      }

      // Migrate Actor Items as well
      for (let i of a.items.contents) {
        try {
          const updateItemData = await _migrateItem(i, oldVersion);
          if (Object.keys(updateItemData).length > 0) {
            console.log(`Migrating ${game.i18n.localize(`TYPES.Item.${i.type}`)} entity ${i.name} from ${game.i18n.localize(`TYPES.Actor.${a.type}`)} entity ${a.name}`);
            await BladesHelpers.tryUpdate(i, updateItemData);
          }
        } catch(err) {
          console.error(err);
        }
      }
    } catch(err) {
      console.error(err);
    }

    // Migrate Token Link for Character and Squad
    /*if (a.type === 'character' || a.type === 'crew') {
      try {
        const updateData = _migrateTokenLink(a);
        if (Object.keys(updateData).length > 0) {
          console.log(`Migrating Token Link for ${a.name}`);
          await BladesHelpers.tryUpdate(a, updateData);
        }
      } catch(err) {
        console.error(err);
      }
    }*/
  }

  // Migrate Actor Link
  /*
  for (let s of game.scenes.contents) {
    try {
      const updateData = _migrateSceneData(s);
      if (Object.keys(updateData).length > 0) {
        console.log(`Migrating Scene entity ${s.name}`);
        await BladesHelpers.tryUpdate(s, updateData);
      }
    } catch(err) {
      console.error(err);
    }
  }*/

  // Migrate Items
  let items = foundry.utils.deepClone(game.items.contents);
  for (let i of items) {
    try {
      const updateData = await _migrateItem(i, oldVersion);
      if (Object.keys(updateData).length > 0) {
        console.log(`Migrating ${game.i18n.localize(`TYPES.Item.${i.type}`)} entity ${i.name}`);
        await BladesHelpers.tryUpdate(i, updateData);
      }
    } catch(err) {
      console.error(err);
    }
  }

  // Set the migration as complete
  game.settings.set("beamsaber", "systemMigrationVersion", newVersion);
  ui.notifications.info(`Beamsaber System Migration to version ${game.system.version} completed!`, {permanent: true});
};


/* -------------------------------------------- */

/**
 * Migrate a single Scene entity to incorporate changes to the data model of it's actor data overrides
 * Return an Object of updateData to be applied
 * @param {Object} scene  The Scene data to Update
 * @return {Object}       The updateData to apply
 */
export const _migrateSceneData = function(scene) {
  const tokens = foundry.utils.deepClone(scene.tokens);
  return {
    tokens: tokens.map(t => {
      t.actorLink = true;
      t.actorData = {};
      return t;
    })
  };
};

/* -------------------------------------------- */

/* -------------------------------------------- */
/*  Entity Type Migration Helpers               */
/* -------------------------------------------- */

/**
 * Migrate the actor attributes
 * @param {Actor} actor   The actor to Update
 * @return {Promise<Object>}       The updateData to apply
 */
async function _migrateActor(actor, version) {
  let updateData = null;

  if (version < 3.0) {
    // Migrate Faction Relationship
    if (actor.type == 'faction') {
      // Merge Allies & Enemies Relationships into one object
      if (actor.system.allies) {
        let allies = actor.system.allies;
        let enemies = actor.system.enemies;
        let relationships = Object.assign({}, Object.values(allies).concat(Object.values(enemies)));
        relationships = Object.assign({}, BladesHelpers.sortObjects(relationships, BladesHelpers.fetchRelationshipData, BladesHelpers._relationshipCompareFunc, BladesHelpers.rebuildRelationshipListFromData));
        updateData = {system: {'==allies': null, '==enemies': null, '==relationships': relationships}};
      }

      // Add Trust for Relationships involving Squads
      let addedTrust = false;
      let relationships = updateData?.system['==relationships'] ?? actor.system.relationships;
      for (let [relationshipId, relationship] of Object.entries(relationships)) {
        let entityFull = BladesHelpers.resolveActor(relationship.uuid);
        if (entityFull?.type == 'crew' && relationship.trust === undefined) {
          addedTrust = true;
          relationships[relationshipId].trust = 5;
        }
      }
      if (addedTrust && !updateData) {
        if (!updateData)
          updateData = {system: {'==relationships': relationships}};
        else
          updateData.system['==relationships'] = relationships;
      }
    } else if (actor.type == 'crew') {
      // Mirror Relationships from Factions
      if (Object.values(actor.system.relationships).length == 0) {
        let relationships = BladesHelpers.rebuildRelationshipListFromData(await BladesHelpers.fetchAllRelationships(actor, true, true));
        updateData = {system: {'==relationships': relationships}};
      }
    }
  }

  if (version < 3.2) {
    if (actor.type == 'character') {
      // Migrate Pilot Vehicle XP to Vehicle sheet
      const attributes = game.model.Actor.vehicle.attributes;
      const vehicleFull = BladesHelpers.resolveActor(actor.system.vehicle);
      if (vehicleFull) {
        for (let [attributeName, attributeData] of Object.entries(actor.system.attributes)) {
          if (Object.keys(attributes).includes(attributeName)) {
            let vehicleUpdateObject = {system: {attributes: {}}};
            vehicleUpdateObject.system.attributes[attributeName] = {'==exp': Number(attributeData.exp)};
            BladesHelpers.tryUpdate(vehicleFull, vehicleUpdateObject);
          }
        }
      }
    }
  }

  if (version < 3.3) {
    if (actor.type == 'region') {
      // Rename faction to owner
      updateData = {system: {'==faction': null, '==owner': actor.system.faction}};
    }
    if (actor.type == 'vehicle') {
      // Rename quirk used to usable
      updateData = {system: {quirks: {}}};
      for (let [quirkId, quirk] in Object.entries(actor.system.quirks))
        updateData.system.quirks[quirkId] = {'==used': null, '==usable': actor.system.quirks[quirkId].used};
    }
  }

  if (version < 3.4) {
    if (actor.type == '\uD83D\uDD5B clock') {
      // Change clock data
      updateData = {system: {'==type': null, '==size': Number(actor.system.type), '==value': Number(actor.system.value), '==styleId': null, "theme_color": 'default/black'}};
    }
  }

  return updateData ?? {};
}

/**
 * Migrate the itrm attributes
 * @param {Item} item   The item to Update
 * @return {Promise<Object>}    The updateData to apply
 */
async function _migrateItem(item, version) {
  let updateData = null;

  if (version < 3.1)
    // Update Cohort Quality & Scale
    if (item.type == 'cohort')
      item.updateCohortQualityScale();

  return updateData ?? {};
}

/* -------------------------------------------- */

/**
 * Make Token be an Actor link.
 * @param {Actor} actor   The actor to Update
 * @return {Object}       The updateData to apply
 */
function _migrateTokenLink(actor) {
  let updateData = {}
  updateData['prototypeToken.actorLink'] = true;

  return updateData;
}

/* -------------------------------------------- */