import { BeamChatMessage } from './messages/beam-chat-message.js';

export class BladesHelpers {
  static isNumberKey(evt) {
    var charCode = (evt.which) ? evt.which : evt.keyCode
    if (charCode > 31 && (charCode < 48 || charCode > 57))
      return false;
    return true;
  }

  static isDowntime(attributeOrRollName) {
    return ['acquireAsset', 'collect', 'cutLoose', 'enhance', 'fix', 'longTermProject', 'manufacture', 'recover', 'salvage', 'schmooze', 'train', 'upkeep', 'moveBase'].includes(attributeOrRollName);
  }

  static createUpdateObjectFromPath(value, path) {
    let reversePath = path.split('.').reverse();
    let updateObject = {};
    updateObject[`==${reversePath[0]}`] = value;
    reversePath.splice(0, 1);
    while (reversePath.length > 0) {
      let newUpdateObject = {};
      newUpdateObject[reversePath[0]] = updateObject;
      updateObject = newUpdateObject;
      reversePath.splice(0, 1);
    }
    return updateObject;
  }

  static mergeAddObjects(obj1, ignoredFields, ...objs) {
    let output = Object.assign({}, obj1);
    for (let obj of objs) {
      for (let [k, v] of Object.entries(obj)) {
        if (ignoredFields.includes(k))
          { /* Nothing */ }
        else if (output[k] !== undefined)
          output[k] += v;
        else
          output[k] = v;
      }
    }
    return output;
  }

  static getClockStyleFolderPath(clockStyle, game) {
    let path = 'systems/beamsaber/themes/';
    if (clockStyle === undefined)
      throw new Error('Clock style does not exist');
    if (clockStyle.inWorldFolder)
      path = `worlds/${game.world.id}/themes/`;
    return path + clockStyle.name;
  }

  static async handleRelationshipValue(ownerFull, entityFull, path, change, set = false, recursive = false) {
    if (path == 'trust')
      return (await BladesHelpers.handleTrust(ownerFull, entityFull, change, set, recursive))[1];

    let squadEntry = ownerFull.system.squads ? Object.entries(ownerFull.system.squads).find(s => s[1].uuid == entityFull.uuid) : null;
    let relationshipEntry = Object.entries(ownerFull.system.relationships).find(s => s[1].uuid == entityFull.uuid);
    let [relationshipId, relationship] = squadEntry ?? relationshipEntry;
    let relationshipPath = squadEntry ? 'squads' : 'relationships';
    let result;
    if (path == 'beliefs')
      result = change;
    else
      result = set ? Number(change) : (Number(relationship[path]) + Number(change));

    let resultDiff = result != relationship[path];
    if (resultDiff) {
      let updateObject = {system: {}};
      updateObject.system[relationshipPath] = {};
      updateObject.system[relationshipPath][relationshipId] = {};
      updateObject.system[relationshipPath][relationshipId][`==${path}`] = result;
      await BladesHelpers.tryUpdate(ownerFull, updateObject);
      if (!recursive && path != 'beliefs')
        await BladesHelpers.handleRelationshipValue(entityFull, ownerFull, path, change, set, true);
      if (!recursive && path == 'status' && ownerFull.type == 'crew' && entityFull.type == 'crew') {
        if (ownerFull.system.is_player_crew) ownerFull.handleVendetta();
        if (entityFull.system.is_player_crew) entityFull.handleVendetta();
      }
    }
    return resultDiff;
  }

  static async handleTrust(ownerFull, entityFull, trustChange, set = false, recursive = false) {
    let squadEntry = ownerFull.system.squads ? Object.entries(ownerFull.system.squads).find(s => s[1].uuid == entityFull.uuid) : null;
    let relationshipEntry = Object.entries(ownerFull.system.relationships).find(s => s[1].uuid == entityFull.uuid);
    let [relationshipId, relationship] = squadEntry ?? relationshipEntry;
    let relationshipPath = squadEntry ? 'squads' : 'relationships';
    let resultTrust = set ? Number(trustChange) : (Number(relationship.trust) + Number(trustChange));
    let trustDelta = resultTrust - Number(relationship.trust);
    let resultStatus = Number(relationship.status);
    while (true) {
      if (resultTrust >= 9) {
        if (resultStatus < 3) {
          resultStatus ++;
          resultTrust -= 8;
          continue;
        } else
          resultTrust = 9;
      } else if (resultTrust <= 0) {
        if (resultStatus > -3) {
          resultStatus --;
          resultTrust += 8;
          continue;
        } else
          resultTrust = 0;
      }
      break;
    }

    let statusDelta = resultStatus - Number(relationship.status);
    let statusHasChanged = resultStatus != relationship.status;
    let trustHasChanged = trustDelta != 0;
    let resultString = '';
    if (trustHasChanged || statusHasChanged) {
      if (trustHasChanged)
        resultString = game.i18n.format(`BITD.Trust${trustDelta < 0 ? 'Loss' : 'Gain'}`, {num: Math.abs(trustDelta), faction: ownerFull.name});
      if (statusHasChanged)
        resultString += `<br/>${game.i18n.format(statusDelta < 0 ? 'BITD.StatusDown' : 'BITD.StatusUp', {
          faction: ownerFull.name,
          relationship_level_string: game.i18n.localize(`BITD.FactionRelationship.${resultStatus}`),
          relationship_level: resultStatus
        })}`;
      let updateObject = {system: {}};
      updateObject.system[relationshipPath] = {};
      updateObject.system[relationshipPath][relationshipId] = {'==trust': resultTrust, '==status': resultStatus};
      await BladesHelpers.tryUpdate(ownerFull, updateObject);
      if (!recursive)
        await BladesHelpers.handleTrust(entityFull, ownerFull, trustChange, set, true);
    }
    return [resultString.trimStart(), statusDelta];
  }

  static async handleReputation(squadFull, repChange, set = false, reason = '') {
    let maxRep = Number(squadFull.system.reputation.max) - Number(squadFull.system.heart);
    let resultRep = Math.max(set ? Number(repChange) : (Number(squadFull.system.reputation.value) + Number(repChange)), 0);
    let repDelta = resultRep - Number(squadFull.system.reputation.value);
    let squadHold = squadFull.system.hold;
    let oldSquadHold = squadHold;
    let notifyTierUp = false;
    while (true) {
      if (resultRep >= maxRep) {
        if (squadHold == 'weak' ^ squadFull.system.vendetta) {
          squadHold = 'strong';
          resultRep -= maxRep;
          continue;
        } else {
          notifyTierUp = true;
          resultRep = maxRep;
        }
      }
      break;
    }
    let realRepDelta = resultRep - Number(squadFull.system.reputation.value);
    let holdIncrease = squadHold != oldSquadHold;
    let repHasChanged = realRepDelta != 0 || holdIncrease;
    let resultString = '';
    if (repHasChanged) {
      if (repHasChanged)
        resultString = game.i18n.format(`BITD.GenericSquad${repDelta < 0 ? 'Loss' : 'Gain'}`, {num: Math.abs(repDelta), name: game.i18n.localize('BITD.Reputation'), reason: reason})
      if (holdIncrease)
        resultString += ` ${game.i18n.localize('BITD.ReputationHoldUp')}`;
      let maxTier = squadFull.system.is_player_crew ? 4 : 5;
      if (notifyTierUp && Number(squadFull.system.tier.value) < maxTier) {
        let costPerTier = Math.max(4 / squadFull.system.sponsor, 1);
        resultString += ` ${game.i18n.format('BITD.ReputationNotifyTierUp', {cost: costPerTier * (Number(squadFull.system.tier.value) + 1)})}`;
      }
      await BladesHelpers.tryUpdate(squadFull, {system: {reputation: {'==value': resultRep}, '==hold': squadHold}});
    }
    return resultString.trimStart();
  }

  static getEntanglementTable(status) {
    let result = 'A';
    if (status >= 0) result = 'C';
    else if (status > -3) result = 'B';
    return result;
  }

  /**
   * Identifies duplicate items by type and returns a array of item ids to remove
   *
   * @param {Object} item_data
   * @param {Document} actor
   * @returns {Array}
   *
   */
  static fetchDuplicatedItemType(item_data, actor) {
    let dupe_list = [];
    let distinct_types = ['crew_type', 'crew_reputation', 'class'];
    let allowed_types = ['item', 'crew_upgrade', 'crew_ability', 'vehicle_gear', 'cohort'];
    let should_be_distinct = distinct_types.includes(item_data.type);
    // If the Item has the exact same name - remove it from list.
    // Remove Duplicate items from the array.
    actor.items.forEach(i => {
      let has_double = (item_data.type === i.type);
      if (((i.name === item_data.name) || (should_be_distinct && has_double)) && !(allowed_types.includes(item_data.type)) && (item_data._id !== i.id))
        dupe_list.push(i.id);
    });

    return dupe_list;
  }

  /**
   * Add item modification if logic exists.
   * @param {Object} item_data
   * @param {Document} entity
   */
  static async callItemLogic(item_data, entity) {
    if ('logic' in item_data.data && item_data.data.logic !== '') {
      let logic = JSON.parse(item_data.data.logic);

      // Should be an array to support multiple expressions
      if (!Array.isArray(logic))
        logic = [logic];

      if (logic) {
        let logic_update = { '_id': entity.id };
        logic.forEach(expression => {

          // Different logic behav. dep on operator.
          switch (expression.operator) {

            // Add when creating.
            case 'addition':
              foundry.utils.mergeObject(
                logic_update,
                {[expression.attribute]: Number(BladesHelpers.getNestedProperty(entity, prefix + expression.attribute)) + expression.value},
                {insertKeys: true}
              );
              break;

            // Change name property.
            case 'attribute_change':
              foundry.utils.mergeObject(
                logic_update,
                {[expression.attribute]: expression.value},
                {insertKeys: true}
              );
              break;
          }
        });
        await Actor.updateDocuments( logic_update );
      }
    }
  }

  /**
   * Undo Item modifications when item is removed.
   * @todo
   *  - Remove all items and then Add them back to
   *    sustain the logic mods
   * @param {Object} item_data
   * @param {Document} entity
   */
  static async undoItemLogic(item_data, entity) {
    if ('logic' in item_data.data && item_data.data.logic !== '') {
      let logic = JSON.parse(item_data.data.logic)

      // Should be an array to support multiple expressions
      if (!Array.isArray(logic))
        logic = [logic];

      if (logic) {
        let logic_update = { '_id': entity.id };
        var entity_data = entity.data;

        logic.forEach(expression => {
          // Different logic behav. dep on operator.
          switch (expression.operator) {
            // Subtract when removing.
            case 'addition':
              foundry.utils.mergeObject(
                logic_update,
                {[expression.attribute]: Number(BladesHelpers.getNestedProperty(entity, expression.attribute)) - expression.value},
                {insertKeys: true}
              );
              break;

            // Change name back to default.
            case 'attribute_change':
              // Get the array path to take data.
              let default_expression_attribute_path = expression.attribute + '_default';
              let default_name = default_expression_attribute_path.split('.').reduce((o, i) => o[i], entity_data);
              foundry.utils.mergeObject(
                logic_update,
                {[expression.attribute]: default_name},
                {insertKeys: true}
              );
              break;
          }
        });
        await Actor.updateDocuments( logic_update );
      }
    }
  }

  /**
   * Get a nested dynamic attribute.
   * @param {Object} obj
   * @param {string} property
   */
  static getNestedProperty(obj, property) {
    return property.split('.').reduce((r, e) => {return r[e]}, obj);
  }

  /**
   *
   * @param {Actor} objectFull
   * @param {object} updateObject
   */
  static async tryCreate(objectsData, parentFull) {
    if (objectsData && parentFull && parentFull.canUserModify(game.user, 'create'))
      return await Item.create(objectsData, {parent: parentFull});
    return [];
  }

  /**
   *
   * @param {Actor} objectFull
   * @param {object} updateObject
   */
  static async tryUpdate(objectFull, updateObject) {
    if (!objectFull)
      return;
    if (objectFull.canUserModify(game.user, 'update'))
      await objectFull.update(updateObject);
    else {
      // Send a specific message to the GM to update some data on their end
      let speaker = ChatMessage.getSpeaker();
      let messageData = {
        speaker: speaker,
        messageType: 'updateRequest',
        updateQuery: JSON.stringify(updateObject),
        objectUuid: objectFull.uuid,
        content: '<div class="special-message"></div>',
        blind: true,
        whisper: game.users.activeGM ? [game.users.activeGM.id] : game.users.filter(u => u.isGM).map(u => u.id)
      }
      let message = await BeamChatMessage.create(messageData);

      if (game.users.activeGM)
        // Wait for the message to be handled to continue;
        await BladesHelpers.until(_ => message.system.handled == true);
      else
        // Notify the player that the data will be handled when a GM connects
        ui.notifications.warn(game.i18n.localize('BITD.log.warn.TryUpdateNoActiveGM'));
    }
  }

  /**
   *
   * @param {Actor} objectFull
   * @param {object} updateObject
   */
  static async tryDelete(objectFull, parentFull) {
    if (!objectFull)
      return;
    if (parentFull && parentFull.canUserModify(game.user, 'delete'))
      await parentFull.deleteEmbeddedDocuments('Item', [objectFull._id]);
    else if (!parentFull && objectFull.canUserModify(game.user, 'delete'))
      await objectFull.delete();
    else {
      // Send a specific message to the GM to delete the object
      let speaker = ChatMessage.getSpeaker();
      let messageData = {
        speaker: speaker,
        messageType: 'deleteRequest',
        objectUuid: objectFull.uuid,
        parentUuid: parentFull ? parentFull.uuid : null,
        objectEmbeddedName: parentFull ? 'Item' : null,
        content: '<div class="special-message"></div>',
        blind: true,
        whisper: game.users.activeGM ? [game.users.activeGM.id] : game.users.filter(u => u.isGM).map(u => u.id)
      }
      let message = await BeamChatMessage.create(messageData);

      if (game.users.activeGM)
        // Wait for the message to be handled to continue;
        await BladesHelpers.until(_ => message.system.handled == true);
      else
        // Notify the player that the data will be handled when a GM connects
        ui.notifications.warn(game.i18n.localize('BITD.log.warn.TryDeleteNoActiveGM'));
    }
  }

  static async until(conditionFunction) {
    const poll = resolve => {
      if (conditionFunction())
        resolve();
      else
        setTimeout(_ => poll(resolve), 10);
    }

    return new Promise(poll);
  }

  static async onRadioToggle(event) {
    let type = event.target.tagName.toLowerCase();
    let element = event.target;
    let target = type == 'label' ? element : element.parentElement;
    let label = target;
    type = target.tagName.toLowerCase();
    if (type == 'label')
      target = label.previousElementSibling;

    // Get the last enabled element
    let enabledLabels = Object.values(target.parentElement.children).filter(e => e.classList.contains('enabled'));
    if (enabledLabels[enabledLabels.length-1] == label || (event.type == 'contextmenu')) {
      //find the next lowest-value input with the same name and click that one instead
      let name = target.name;
      if (!name) name = $(target).data('name');
      let value = target.value;
      if (!value) value = $(target).data('value');
      value = parseInt(value);
      if (value < 0) value += 1;
      else value -= 1;
      let prevEl = $(target.parentElement).find(`[name='${name}'][value='${value}'], [data-name='${name}'][value='${value}'], [name='${name}'][data-value='${value}'], [data-name='${name}'][data-value='${value}']`);
      prevEl.trigger('click');
    } else {
      //trigger the click on this one
      $(target).trigger('click');
    }
  }

  static async transferItems(target, recipient, type) {
    let items = target.items.filter(i => i.type == type && i.system.owner == null);
    // Container Transfer Recursion
    while (items.length) {
      let containerItems = target.items.filter(i => items.map(i => i._id).includes(i.system.owner) && !items.includes(i));
      if (containerItems.length)
        items = items.concat(containerItems);
      else
        break;
    }
    await Item.create(items, {parent: recipient});
    await target.deleteEmbeddedDocuments('Item', items.map(i => i.id));
  }

  static computeLoad(actor, isVehicleLoad, containerId) {
    let load = 0;
    let hiddenItemsHaveNoLoad = false;
    let pilot = actor;
    let crew = undefined;
    // Discount Load from Hidden Items
    if (isVehicleLoad && actor.type == 'vehicle') {
      pilot = BladesHelpers.resolveActor(actor.system.pilot);
      if (pilot)
        actor = pilot;
      crew = pilot?.system.crew;
      if (typeof crew != 'object' && crew != undefined)
        crew = BladesHelpers.resolveActor(pilot.system.crew);
      hiddenItemsHaveNoLoad = crew?.system.hide_items_load;
    }
    actor.items.forEach(i => {
      if (containerId)
        isVehicleLoad = i.type === 'vehicle_gear';
      if (i.system.owner == containerId) {
        if (isVehicleLoad)
          load += (containerId || (i.type === 'vehicle_gear' && !i.system.suppressed)) ? Math.max(parseInt(i.system.load) - (i.system.experimental ? 1 : 0), 0) : 0;
        else
          load += (containerId || (i.type === 'item') && !(hiddenItemsHaveNoLoad && i.system.hidden)) ? parseInt(i.system.load) : 0;
      }
    });
    // Discount Load from Rigging
    if (!containerId) {
      if (crew)
        load = Math.max(0, load - (isVehicleLoad ? crew?.system.mech_load_rigging : crew?.system.load_rigging));
      load = Math.max(0, Math.min(11, load));
    }
    return load;
  }

  static computeMaxLoad(actor, container) {
    let result = container.system.container_load;
    if (container.system.hunter_robot) result += actor.system.hunter_robot_load ?? 0;
    if (container.system.hackrig) result += actor.system.hackrig_load ?? 0;
    return result;
  }

  /**
   * Add item functionality
   */
  static async _addOwnedItem(event, actor) {
    event.preventDefault();
    const a = event.currentTarget;
    const itemType = a.dataset.itemType;

    let data = {
      name: randomID(),
      type: itemType
    };
    let result = await actor.createEmbeddedDocuments('Item', [data]);
    for (let item of result)
      await BladesHelpers.postCreateItem(item, actor);
    return result;
  }

  static async postCreateItem(item, actor) {
    if (item.type == 'cohort') {
      await BladesHelpers.tryUpdate(item, {system: {'==crew': actor.uuid}});

      let updatedGangType = false;
      // Blood Brothers: All newly created Fire Team Cohorts are Toughs
      if (actor.system.blood_brothers) {
        item.system.gang_type.push('Toughs');
        updatedGangType = true;
      }
      // Training Center: All newly created Fire Team Cohorts are matching the Training Center's Fire Team type
      if (actor.system.training_center) {
        let training_center = actor.items.filter(i => i.system.training_center == true)[0];
        if (!item.system.gang_type.includes(training_center.system.training_center_type)) {
          item.system.gang_type.push(training_center.system.training_center_type);
          updatedGangType = true;
        }
      }
      if (updatedGangType) {
        item.system.gang_type.sort();
        await BladesHelpers.tryUpdate(item, {system: {'==gang_type': item.system.gang_type}});
      }
    }

    // Blood Brothers: Give all Fire Team Cohorts the Toughs type
    if (item.system.blood_brothers) {
      for (let cohort of actor.items.filter(i => i.type == 'cohort')) {
        if (cohort.system.type == 'Gang' && !cohort.system.gang_type.includes('Toughs')) {
          cohort.system.gang_type.push('Toughs');
          cohort.system.gang_type.sort();
          await BladesHelpers.tryUpdate(cohort, {system: {'==gang_type': cohort.system.gang_type}});
        }
      }
    }
    // Training Center: Give all Fire Team Cohorts the Toughs type
    if (item.system.training_center) {
      for (let cohort of actor.items.filter(i => i.type == 'cohort')) {
        if (cohort.system.type == 'Gang' && !cohort.system.gang_type.includes(item.system.training_center_type)) {
          cohort.system.gang_type.push(item.system.training_center_type);
          cohort.system.gang_type.sort();
          await BladesHelpers.tryUpdate(cohort, {system: {'==gang_type': cohort.system.gang_type}});
        }
      }
    }
    // Well-Trained Hunter Robot: Create a special Cohort
    if (item.system.hunter_robot) {
      let squadFull = null;
      if (actor.system.crew)
        squadFull = BladesHelpers.resolveActor(actor.system.crew);
      if (squadFull) {
        let data = {name: game.i18n.format('BITD.HunterRobotName', {characterName: actor.name}), type: 'cohort', system: {type: 'Expert', owner: actor.uuid}};
        let result = await squadFull.createEmbeddedDocuments('Item', [data]);
        for (let item of result)
          await BladesHelpers.postCreateItem(item, squadFull);
      }
    }
    // War Dogs: Update Vendetta status
    if (item.system.war_dogs)
      await actor.handleVendetta();

    // Pilot & Vehicle Armor
    if (['item', 'vehicle_gear'].includes(item.type) && item.system.armor) {
      let differentActor = false;
      if (item.type == 'vehicle_gear' && actor.type != 'vehicle') {
        actor = BladesHelpers.resolveActor(actor.system.vehicle);
        differentActor = true;
      }
      let armorData = actor.system.armor;
      armorData.max ++;
      armorData.value ++;
      await BladesHelpers.tryUpdate(actor, {system: {armor: {'==max': armorData.max, '==value': armorData.value}}});
    }
  }

  static async preDeleteItem(item, actor, realDelete = true) {
    let [owner, _] = actor.getItemOwner(item);

    // Well-Trained Hunter Robot: Remove the special Cohort
    if (item.system.hunter_robot) {
      let squadFull = null;
      if (owner.system.crew)
        squadFull = BladesHelpers.resolveActor(owner.system.crew);
      if (squadFull) {
        let cohortIds = squadFull.items.filter(i => i.system.owner == owner.uuid).map(i => i._id);
        if (cohortIds.length)
          await BladesHelpers.tryDelete(cohortIds[0], actor);
      }
    }

    // Pilot & Vehicle Armor
    if (['item', 'vehicle_gear'].includes(item.type)) {
      if (item.system.armor) {
        let shieldOwner = actor;
        if (item.type == 'vehicle_gear' && shieldOwner.type != 'vehicle')
          shieldOwner = BladesHelpers.resolveActor(actor.system.vehicle);
        let armorData = shieldOwner.system.armor;
        armorData.max --;
        armorData.value = Math.min(armorData.max, armorData.value);
        await BladesHelpers.tryUpdate(shieldOwner, {system: {'==armor': armorData}});
      }
    }

    // Containers: Remove all items contained within
    if (realDelete)
      for (let containedItem of owner.items.filter(i => i.system.owner == item._id))
        await owner.removeItem(containedItem);
  }

  static async postDeleteItem(itemCopy, actor, realDelete = true) {
    // Update Vendetta
    if (itemCopy.system.war_dogs)
      await actor.handleVendetta();
  }

  static async updateTrainingCenterType(squadFull, oldGangType, newGangType) {
    for (let cohort of squadFull.items.filter(i => i.type == 'cohort')) {
      if (cohort.system.type == 'Gang') {
        let somethingWasDone = false;
        // Remove the old training center type if it exists and there are multiple types
        if (cohort.system.gang_type.includes(oldGangType) && cohort.system.gang_type.length > 1) {
          let index = cohort.system.gang_type.indexOf(oldGangType);
          cohort.system.gang_type.splice(index, 1);
          somethingWasDone = true;
        }
        // Add the new training center type if it doesn't exist
        if (!cohort.system.gang_type.includes(newGangType)) {
          cohort.system.gang_type.push(newGangType);
          somethingWasDone = true;
        }
        if (somethingWasDone) {
          cohort.system.gang_type.sort();
          await BladesHelpers.tryUpdate(cohort, {system: {'==gang_type': cohort.system.gang_type}})
        }
      }
    }
  }

  /**
   * Get the list of all available ingame objects by type.
   *
   * @param {string | List<string>} objectTypes
   * @param {Object} game
   */
  static getAllObjectsByType(objectTypes, exclusionList, game) {
    if (!Array.isArray(objectTypes))
      objectTypes = [objectTypes];

    let output = [];
    for (let objectType of objectTypes) {
      let isActor = ['faction', 'crew', 'character', 'vehicle', 'npc', 'region'].includes(objectType);
      let container = isActor ? game.actors : game.items;
      let worldObjects = container.filter(e => e.type === objectType && !exclusionList.includes(e.uuid)).map(e => { return e });

      let objectList = worldObjects;
      if (!isActor) {
        let pack = game.packs.find(e => e.metadata.name === objectType);
        let compendiumItems = [];
        for (let object of pack)
          compendiumItems.push(object);
        objectList = objectList.concat(compendiumItems);
      }
      output = output.concat(objectList.sort((a, b) => a.name.toUpperCase().localeCompare(b.name.toUpperCase())));
    }
    return output;
  }

  /**
   * Get the list of all available ingame object documents by type.
   *
   * @param {string | List<string>} objectTypes
   * @param {Object} game
   */
  static async getAllObjectDocumentsByType(objectTypes, exclusionList, game) {
    if (!Array.isArray(objectTypes))
      objectTypes = [objectTypes];

    let output = [];
    for (let objectType of objectTypes) {
      let isActor = ['faction', 'crew', 'character', 'vehicle', 'npc', 'region'].includes(objectType);
      let container = isActor ? game.actors : game.items;
      let worldObjects = container.filter(e => e.type === objectType && !exclusionList.includes(e.uuid)).map(e => { return e });

      let objectList = worldObjects;
      if (!isActor) {
        let pack = game.packs.find(e => e.metadata.name === objectType);
        let compendiumContent = await pack.getDocuments();
        let compendiumItems = compendiumContent.map(e => { return e });
        objectList = objectList.concat(compendiumItems);
      }
      output = output.concat(objectList.sort((a, b) => a.name.toUpperCase().localeCompare(b.name.toUpperCase())));
    }
    return output;
  }

  static prepareItemDropdown(itemType, allowEmpty, game) {
    let items = BladesHelpers.getAllObjectsByType(itemType, [], game);

    let result = {};
    if (allowEmpty)
      result[''] = game.i18n.localize('BITD.None');
    items.forEach(item => { result[item._id] = item.name; });

    return result;
  }

  static getOwnedItem(obj, itemId, defaultValue = null) {
    if (itemId) {
      const itemCollectionId = obj.items.contents.findIndex(i => i._id == itemId);
      if (itemCollectionId >= 0)
        return obj.items.contents[itemCollectionId];
    }
    return defaultValue;
  }

  static resolveOwnedItem(itemId, itemType, defaultValue, game) {
    if (!itemId)
      return defaultValue;

    // Check World Objects
    let worldResult = BladesHelpers.resolveWorldItem(itemId, game);
    if (worldResult)
      return worldResult;

    // Check Compendium Objects
    if (itemType) {
      let compendiumResult = BladesHelpers.resolveCompendiumItem(itemId, itemType, game);
      if (compendiumResult)
        return compendiumResult;
    }

    console.warn(`Could not resolve actor or item with ID ${itemId}.`)
    return defaultValue;
  }

  static resolveWorldItem(itemId, game) {
    // Check Actor
    let actor = game.actors.filter(e => e._id === itemId);
    if (actor.length > 0)
      return actor[0];

    // Check World Items
    let item = game.items.filter(e => e._id === itemId);
    if (item.length > 0)
      return item[0];
  }

  static resolveCompendiumItem(itemId, itemType, game) {
    let pack = game.packs.find(e => e.metadata.name === itemType);
    return pack?.contents.find(e => e._id == itemId);
  }

  static resolveActor(obj, errorObj) {
    let objFull;
    if (obj) {
      if (obj.uuid) obj = obj.uuid;
      objFull = fromUuidSync(obj);
      if (!objFull)
        objFull = errorObj;
    } else
      objFull = null;
    return objFull;
  }

  /* -------------------------------------------- */

  /**
   * Returns the label for attribute.
   *
   * @param {string} attributeName
   * @returns {string}
   */
  static getAttributeLabel(attributeName) {
    let attributeLabels = {};
    const attributes = {...game.model.Actor.character.attributes, ...game.model.Actor.vehicle.attributes};
    for (const attName in attributes) {
      attributeLabels[attName] = attributes[attName].label;
      for (const actionName in attributes[attName].actions)
        attributeLabels[actionName] = attributes[attName].actions[actionName].label;
    }

    return attributeLabels[attributeName];
  }

  /**
   * Returns the label for roll type.
   *
   * @param {string} rollName
   * @returns {string}
   */
  static getRollLabel(rollName) {
    const attributes = {...game.model.Actor.character.attributes, ...game.model.Actor.vehicle.attributes};
    for (const attName in attributes) {
      if (attName == rollName)
        return attributes[attName].label;
      for (const actionName in attributes[attName].actions)
        if (actionName == rollName)
          return attributes[attName].actions[actionName].label;
    }

    return rollName;
  }

  static getAllActions(allowVehicle = true) {
    let result = [];
    const attributes = allowVehicle ? {...game.model.Actor.character.attributes, ...game.model.Actor.vehicle.attributes} : game.model.Actor.character.attributes;
    for (const attName in attributes)
      for (const actionName in attributes[attName].actions)
        result.push(actionName);
    return result;
  }

  /**
   * Returns true if the attribute is an action
   *
   * @param {string} attributeName
   * @returns {Boolean}
   */
  static isAttributeAction(attributeName) {
    const attributes = {...game.model.Actor.character.attributes, ...game.model.Actor.vehicle.attributes};
    for (const attName in attributes)
      for (const actionName in attributes[attName].actions)
        if (actionName == attributeName)
          return true;

    return false;
  }

  /**
   * Returns true if the attribute is an attribute
   *
   * @param {string} attributeName
   * @returns {Boolean}
   */
  static isAttributeAttribute(attributeName) {
    const attributes = {...game.model.Actor.character.attributes, ...game.model.Actor.vehicle.attributes};
    return (attributeName in attributes);
  }

  /**
   * Returns the attribute linked to a given action
   * @param {string} checkedActionName
   * @returns {string}
   */
  static getAttributeFromAction(checkedActionName) {
    const attributes = {...game.model.Actor.character.attributes, ...game.model.Actor.vehicle.attributes};
    for (const attName in attributes)
      for (const actionName in attributes[attName].actions)
        if (actionName == checkedActionName)
          return attName;

    return undefined;
  }

  /* -------------------------------------------- */

  static capitalize(str) {
    return String(str).charAt(0).toUpperCase() + String(str).substr(1).toLowerCase();
  }

  /* -------------------------------------------- */

  static async sendClockStyleRequest() {
    // Send a specific message to the GM to update some data on their end
    let speaker = ChatMessage.getSpeaker();
    let messageData = {
      speaker: speaker,
      messageType: 'clockStylesRequest',
      userId: game.userId,
      content: '<div class="special-message"></div>',
      blind: true,
      whisper: game.users.activeGM ? [game.users.activeGM.id] : game.users.filter(u => u.isGM).map(u => u.id)
    }
    let message = await BeamChatMessage.create(messageData);

    if (!game.users.activeGM)
      // Notify the player that the data will be handled when a GM connects
      ui.notifications.warn(game.i18n.localize('BITD.log.warn.ClockStylesRequestNoActiveGM'));
  }

  static async sendClockStyleResponseBroadcast() {
    for (const user of game.users.contents.filter(u => u.id != game.userId && u.active)) {
      let speaker = ChatMessage.getSpeaker();
      let messageData = {
        speaker: speaker,
        messageType: 'clockStylesResponse',
        clockStyles: BladesHelpers.clockStyles,
        content: '<div class="special-message"></div>',
        blind: true,
        whisper: [user.id]
      }
      let message = await BeamChatMessage.create(messageData);
    }
  }

  static handleClockImageError(ev) {
    let element = ev.currentTarget;
    element.src = 'systems/beamsaber/themes/cross.png';
    element.parentElement.dataset.tooltip = game.i18n.format('BITD.log.warn.NoClockImage', {
      theme: element.dataset.theme,
      color: element.dataset.color,
      size: element.dataset.size,
      fill: element.dataset.fill
    })
  }

  /* -------------------------------------------- */

  static clockStyles = {};

  static async loadAllClockStyles() {
    BladesHelpers.clockStyles = {};
    let clockStylesShifts = game.settings.get('beamsaber', 'ClockStyles').contents;

    const firstClockRegex = new RegExp('(?<size>[0-9]+)clock_0.(?<extension>.*)');
    const themeContainerFolders = [`worlds/${game.world.id}/themes`, 'systems/beamsaber/themes'];
    for (const themeContainerFolder of themeContainerFolders) {
      let themeFolders;
      try {
        themeFolders = await foundry.applications.apps.FilePicker.browse('data', themeContainerFolder).then(f => f.dirs);
      } catch {
        // No themes folder, skip
        continue;
      }

      for (const themeFolder of themeFolders) {
        const theme = themeFolder.split('/').pop();
        const colorFolders = await foundry.applications.apps.FilePicker.browse('data', themeFolder).then(f => f.dirs);
        if (!BladesHelpers.clockStyles[theme])
          BladesHelpers.clockStyles[theme] = {};

        for (const colorFolder of colorFolders) {
          const color = colorFolder.split('/').pop();
          const filePaths = await foundry.applications.apps.FilePicker.browse('data', colorFolder).then(f => f.files);
          if (!BladesHelpers.clockStyles[theme][color])
            BladesHelpers.clockStyles[theme][color] = {};

          for (const fileData of filePaths.map(f => firstClockRegex.exec(f.split('/').pop())).filter(f => f != null)) {
            if (BladesHelpers.clockStyles[theme][color][fileData.groups.size])
              continue;
            const fileName = fileData.input;
            const clockData = {
              theme: theme,
              color: color,
              size: fileData.groups.size,
              extension: fileData.groups.extension,
              inWorldFolder: themeFolder.startsWith('worlds/'),
              baseSprite: fileName,
              shifted: clockStylesShifts?.[theme]?.[color]?.[fileData.groups.size]?.shifted ?? false
            };

            let clockImages = {'0': {file: fileName}};
            const clockRegex = new RegExp(`${fileData.groups.size}clock_(?<state>[1-9][0-9]*).${fileData.groups.extension}`);
            const looseClockRegex = new RegExp(`${fileData.groups.size}clock_(?<state>[1-9][0-9]*).(?<extension>.*)`);
            for (let clockFileData of filePaths.map(f => clockRegex.exec(f.split('/').pop())).filter(f => f != null))
              if (clockFileData.index == 0)
                clockImages[clockFileData.groups.state] = {file: clockFileData.input};
            for (let clockFileData of filePaths.map(f => looseClockRegex.exec(f.split('/').pop())).filter(f => f != null))
              if (!clockImages[clockFileData.groups.state])
                if (clockFileData.index == 0)
                  clockImages[clockFileData.groups.state] = {file: clockFileData.input, dataReason: 'BITD.Settings.ClockStyles.WrongExtension'};

            let reasons = [];
            for (let clockState of Array(Number(fileData.groups.size) + 1).fill().map((_, i) => String(i))) {
              const clockStateData = clockImages[clockState];
              if (!clockStateData)
                reasons.push(game.i18n.format('BITD.Settings.ClockStyles.MissingClockState', {fill: clockState}));
              else if (clockStateData.dataReason == 'BITD.Settings.ClockStyles.WrongExtension')
                reasons.push(game.i18n.format(clockStateData.dataReason, {fill: clockState, bad: clockStateData.file.split('.', 2).pop(), good: clockData.extension}));
              else if (clockStateData.dataReason)
                reasons.push(game.i18n.location(clockStateData.dataReason));
            }
            clockData.dataReason = reasons.join('<br/>');
            BladesHelpers.clockStyles[theme][color][fileData.groups.size] = clockData;
          }
          BladesHelpers.clockStyles[theme][color].dataReason = Object.entries(BladesHelpers.clockStyles[theme][color])
            .filter(s => s[0] != 'dataReason' && s[1].dataReason != '')
            .map(s => `${(s[1].dataReason ?? '')
              .split('<br/>')
              .map(s2 => `${game.i18n.localize('BITD.Settings.ClockStyles.Size')} ${s[0]}: ${s2}`)
              .join('<br/>')}`)
            .join('<br/>');
        }
        BladesHelpers.clockStyles[theme] = Object.fromEntries(Object.entries(BladesHelpers.clockStyles[theme]).sort((a, b) => a[0].localeCompare(b[0], 'en-US')));
        BladesHelpers.clockStyles[theme].dataReason = Object.entries(BladesHelpers.clockStyles[theme])
          .filter(c => c[0] != 'dataReason' && c[1].dataReason != '')
          .map(c => `${(c[1].dataReason ?? '')
            .split('<br/>')
            .map(c2 => `${game.i18n.localize('BITD.Settings.ClockStyles.Color')} ${c[0]}, ${c2}`)
            .join('<br/>')}`)
          .join('<br/>');
      }
      BladesHelpers.clockStyles = Object.fromEntries(Object.entries(BladesHelpers.clockStyles).sort((a, b) => a[0].localeCompare(b[0], 'en-US')));
    }

    if (Object.keys(BladesHelpers.clockStyles).length == 0 && !game.user.isGM)
      await BladesHelpers.sendClockStyleRequest();
    if (game.user.isGM)
      await BladesHelpers.sendClockStyleResponseBroadcast();
  }

  static getClockSpritePath(clockStyle) {
    let path = 'systems/beamsaber/themes/';
    if (clockStyle.inWorldFolder)
      path = `worlds/${game.world.id}/themes/`;
    return path + `${clockStyle.theme}/${clockStyle.color}/`;
  }

  /* -------------------------------------------- */

  static sortObjects(objs, fetchFunc, compareFunc, rebuildFunc, extraFields = []) {
    let objsFull = fetchFunc(objs, extraFields);
    let objsFullSortedArray = Object.values(objsFull).sort(compareFunc);
    return rebuildFunc(objsFullSortedArray, extraFields);
  }

  static printSameObjectError(fromOwner, owner, obj) {
    if (fromOwner) {
      ui.notifications.info(game.i18n.format('BITD.log.info.SameObjectFromOwner', {
        owner: game.i18n.localize(`TYPES.Actor.${owner}`),
        obj: game.i18n.localize(`TYPES.Actor.${obj}`)
      }));
    } else {
      ui.notifications.info(game.i18n.format('BITD.log.info.SameObjectFromOwned', {
        owner: game.i18n.localize(`TYPES.Actor.${owner}`),
        obj: game.i18n.localize(`TYPES.Actor.${obj}`)
      }));
    }
  }

  /* -------------------------------------------- */

  // Sets the region of a crew and adds the crew to the region's crew list
  static async addSquadRegion(squadFull, regionFull, fromSquad) {
    if (squadFull.system.region === regionFull.uuid) {
      BladesHelpers.printSameObjectError(fromSquad, 'crew', 'region');
      return;
    }

    let oldRegion = squadFull.system.region;
    if (squadFull.system.region)
      await BladesHelpers.removeSquadRegion(squadFull, true);

    // Also update squad members if they're in the same region as the squad
    for (let member of Object.values(squadFull.system.members)) {
      let memberFull = BladesHelpers.resolveActor(member.uuid);
      if (memberFull?.system.region == oldRegion)
        if (memberFull.type == 'character')
          await BladesHelpers.addCharacterRegion(memberFull, regionFull, true);
        else
          await BladesHelpers.addRegionNPC(regionFull, memberFull, false);
    }

    let squads = regionFull.system.squads;
    squads.push({uuid: squadFull.uuid});
    squads = BladesHelpers.sortObjects(squads, BladesHelpers.fetchSimpleData, BladesHelpers._simpleCompareFunc, BladesHelpers.rebuildSimplesFromData);
    await BladesHelpers.tryUpdate(regionFull, {system: {'==squads': squads}});
    await BladesHelpers.tryUpdate(squadFull, {system: {'==region': regionFull.uuid}});
  }

  // Removes a crew's region and removes the crew from the region's crew list
  static async removeSquadRegion(squadFull, dontUpdateMembers = false) {
    let regionFull = BladesHelpers.resolveActor(squadFull.system.region);
    if (regionFull) {
      let regionSquads = regionFull.system.squads;
      regionSquads.splice(regionSquads.findIndex(s => s.uuid === squadFull.uuid), 1);
      await BladesHelpers.tryUpdate(regionFull, {system: {'==squads': regionSquads}});
    }

    if (!dontUpdateMembers)
      // Also update squad members if they're in the same region as the squad
      for (let member of Object.values(squadFull.system.members)) {
        let memberFull = BladesHelpers.resolveActor(member.uuid);
        if (memberFull?.system.region == squadFull.system.region)
          if (memberFull.type == 'character')
            await BladesHelpers.removeCharacterRegion(memberFull);
          else
            await BladesHelpers.removeNPCRegion(memberFull);
      }
    await BladesHelpers.tryUpdate(squadFull, {system: {'==region': null}});
  }

  /* -------------------------------------------- */

  // Sets the squad of a character and add the character to the squad's member list
  static async addSquadCharacter(squadFull, characterFull, fromSquad) {
    if (characterFull.system.crew === squadFull.uuid) {
      BladesHelpers.printSameObjectError(fromSquad, 'crew', 'character');
      return;
    }

    if (characterFull.system.crew)
      await BladesHelpers.removeSquadCharacter(characterFull);
    let squadMembersArray = Object.values(squadFull.system.members);
    squadMembersArray.push({uuid: characterFull.uuid});
    squadMembersArray = BladesHelpers.sortObjects(squadMembersArray, BladesHelpers.fetchSimpleData, BladesHelpers._simpleCompareFunc, BladesHelpers.rebuildSimplesFromData);
    let newSquadMembers = Object.assign({}, squadMembersArray);
    await BladesHelpers.tryUpdate(squadFull, {system: {'==members': newSquadMembers}});
    await BladesHelpers.tryUpdate(characterFull, {system: {'==crew': squadFull.uuid}});
    // Well-Trained Hunter Robot: Add the special cohort
    for (let hunter_robot of characterFull.items.filter(i => i.system.hunter_robot == true))
      await BladesHelpers.postCreateItem(hunter_robot, characterFull);
  }

  // Removes a character's squad and remove the character from its squad's member list
  static async removeSquadCharacter(characterFull) {
    let squadFull = BladesHelpers.resolveActor(characterFull.system.crew);
    if (squadFull) {
      let squadMembersArray = Object.values(squadFull.system.members);
      squadMembersArray.splice(squadMembersArray.map(e => e.uuid).indexOf(characterFull.uuid), 1);
      let newSquadMembers = Object.assign({}, squadMembersArray);
      // Well-Trained Hunter Robot: Remove the special cohort
      for (let hunter_robot of characterFull.items.filter(i => i.system.hunter_robot == true))
        await BladesHelpers.preDeleteItem(hunter_robot, characterFull, false);
      await BladesHelpers.tryUpdate(squadFull, {system: {'==members': newSquadMembers}});
    }
    await BladesHelpers.tryUpdate(characterFull, {system: {'==crew': null}});
  }

  // Sets the squad of an NPC and add the NPC to the squad's member list
  static async addSquadNPC(squadFull, npcFull, fromSquad) {
    if (npcFull.system.crew === squadFull.uuid) {
      BladesHelpers.printSameObjectError(fromSquad, 'crew', 'npc');
      return;
    }

    if (npcFull.system.crew)
      await BladesHelpers.removeSquadNPC(npcFull);
    let squadMembersArray = Object.values(squadFull.system.members);
    squadMembersArray.push({uuid: npcFull.uuid});
    squadMembersArray = BladesHelpers.sortObjects(squadMembersArray, BladesHelpers.fetchSimpleData, BladesHelpers._simpleCompareFunc, BladesHelpers.rebuildSimplesFromData);
    let newSquadMembers = Object.assign({}, squadMembersArray);
    // Match crew faction
    if (squadFull.system.faction != npcFull.system.faction) {
      let factionFull = BladesHelpers.resolveActor(squadFull.system.faction);
      if (factionFull)
        await BladesHelpers.addFactionNPC(factionFull, npcFull, true, true);
      else
        await BladesHelpers.removeFactionNPC(npcFull);
    }
    await BladesHelpers.tryUpdate(squadFull, {system: {'==members': newSquadMembers}});
    await BladesHelpers.tryUpdate(npcFull, {system: {'==crew': squadFull.uuid}});
  }

  // Removes an NPC's squad and remove the NPC from its squad's member list
  static async removeSquadNPC(npcFull) {
    let squadFull = BladesHelpers.resolveActor(npcFull.system.crew);
    if (squadFull) {
      let squadMembersArray = Object.values(squadFull.system.members);
      squadMembersArray.splice(squadMembersArray.map(e => e.uuid).indexOf(npcFull.uuid), 1);
      let newSquadMembers = Object.assign({}, squadMembersArray);
      await BladesHelpers.tryUpdate(squadFull, {system: {'==members': newSquadMembers}});
    }
    await BladesHelpers.tryUpdate(npcFull, {system: {'==crew': null}});
  }

  /* -------------------------------------------- */

  // Sets the region of a character and adds the character to the region's character list
  static async addCharacterRegion(characterFull, regionFull, fromCharacter) {
    if (characterFull.system.vehicle === regionFull.uuid) {
      BladesHelpers.printSameObjectError(fromCharacter, 'character', 'region');
      return;
    }

    if (characterFull.system.vehicle)
      await BladesHelpers.removeCharacterRegion(characterFull);

    let characters = regionFull.system.characters;
    characters.push({uuid: characterFull.uuid});
    characters = BladesHelpers.sortObjects(characters, BladesHelpers.fetchSimpleData, BladesHelpers._simpleCompareFunc, BladesHelpers.rebuildSimplesFromData);
    await BladesHelpers.tryUpdate(regionFull, {system: {'==characters': characters}});
    await BladesHelpers.tryUpdate(characterFull, {system: {'==region': regionFull.uuid}});
  }

  // Removes a character's region and removes the character from the region's character list
  static async removeCharacterRegion(characterFull) {
    let regionFull = BladesHelpers.resolveActor(characterFull.system.region);
    if (regionFull) {
      let regionCharacters = regionFull.system.characters;
      regionCharacters.splice(regionCharacters.findIndex(s => s.uuid === characterFull.uuid), 1);
      await BladesHelpers.tryUpdate(regionFull, {system: {'==characters': regionCharacters}});
    }
    await BladesHelpers.tryUpdate(characterFull, {system: {'==region': null}});
  }

  /* -------------------------------------------- */

  // Sets the vehicle of a character and assigns the character as the vehicle's pilot
  static async addCharacterVehicle(characterFull, vehicleFull, fromCharacter) {
    if (!characterFull.isOwner || !vehicleFull.isOwner) {
      ui.notifications.warn(game.i18n.localize('BITD.log.warn.MustOwnCharacterAndVehicle'));
      return;
    }
    if (characterFull.system.vehicle === vehicleFull.uuid) {
      BladesHelpers.printSameObjectError(fromCharacter, 'character', 'vehicle');
      return;
    }

    if (characterFull.system.vehicle)
      await BladesHelpers.removeCharacterVehicle(characterFull);
    if (vehicleFull.system.pilot) {
      let vehiclePilotFull = BladesHelpers.resolveActor(vehicleFull.system.pilot)
      if (vehiclePilotFull)
        await BladesHelpers.removeCharacterVehicle(vehiclePilotFull);
    }

    // Transfer all vehicle gear from the vehicle to the pilot
    await BladesHelpers.transferItems(vehicleFull, characterFull, 'vehicle_gear');
    await BladesHelpers.tryUpdate(vehicleFull, {system: {'==pilot': characterFull.uuid}});
    await BladesHelpers.tryUpdate(characterFull, {system: {'==vehicle': vehicleFull.uuid}});
  }

  // Removes a character's vehicle and removes the vehicle's pilot
  static async removeCharacterVehicle(characterFull) {
    const vehicleFull = BladesHelpers.resolveActor(characterFull.system.vehicle);
    if (!characterFull.isOwner) {
      ui.notifications.warn(game.i18n.localize('BITD.log.warn.MustOwnCharacterAndVehicle'));
      return;
    }
    if (vehicleFull) {
      if (!vehicleFull.isOwner) {
        ui.notifications.warn(game.i18n.localize('BITD.log.warn.MustOwnCharacterAndVehicle'));
        return;
      }
      // Transfer all vehicle gear from the pilot to the vehicle
      await BladesHelpers.transferItems(characterFull, vehicleFull, 'vehicle_gear');
      await BladesHelpers.tryUpdate(vehicleFull, {system: {'==pilot': null}});
    }
    await BladesHelpers.tryUpdate(characterFull, {system: {'==vehicle': null}});
  }

  /* -------------------------------------------- */

  // Adds a connection to a character
  static async addCharacterConnection(characterFull, objectFull, fromCharacter, oldConnectionId) {
    if (Object.values(characterFull.system.connections).find(c => c.uuid == objectFull.uuid)) {
      BladesHelpers.printSameObjectError(fromCharacter, 'character', 'npc');
      return false;
    }
    let connection;
    if (!oldConnectionId) {
      oldConnectionId = Object.values(characterFull.system.connections).length;
      connection = {
        uuid: objectFull.uuid,
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
      };
    } else
      connection = characterFull.system.connections[oldConnectionId];

    let updateObject = {system: {connections: {}}};
    updateObject.system.connections[`==${oldConnectionId}`] = connection;
    await BladesHelpers.tryUpdate(characterFull, updateObject);
  }

  static fetchConnectionsToActor(actorUuid) {
    let characters = game.actors.filter(a => a.type == 'character');
    let connectionsData = characters.map(a => { return {uuid: a.uuid, connections: Object.values(a.system.connections)}; });
    let actorConnectionsData = connectionsData.map(c => { return {uuid: c.uuid, connection: c.connections.find(c2 => c2.uuid == actorUuid)}; }).filter(c => c.connection != null);
    let actorConnections = actorConnectionsData.map(c => { return {...c.connection, uuid: c.uuid}; });
    return actorConnections;
  }

  /* -------------------------------------------- */

  static async addFactionSquad(factionFull, squadFull, fromFaction) {
    // Check current owner is not BladesHelpers faction
    if (squadFull.system.faction === factionFull.uuid) {
      BladesHelpers.printSameObjectError(fromFaction, 'faction', 'crew');
      return;
    }

    // Check for previous owner and delete it
    if (squadFull.system.faction)
      await BladesHelpers.removeFactionSquad(squadFull);

    // Check if relationship and delete it
    let crewAsRelationship = Object.values(factionFull.system.relationships).find(r => r.uuid == squadFull.uuid);
    if (crewAsRelationship)
      await BladesHelpers.removeRelationship(factionFull, squadFull);

    // Add as owner
    let squads = factionFull.system.squads;
    squads[Object.entries(squads).length] = {uuid: squadFull.uuid, trust: crewAsRelationship?.trust ?? 5, status: 0, beliefs: ''};
    squads = Object.assign({}, BladesHelpers.sortObjects(squads, BladesHelpers.fetchSimpleData, BladesHelpers._factionSquadCompareFunc, BladesHelpers.rebuildSimplesFromData, ['trust', 'status']));
    await BladesHelpers.tryUpdate(factionFull, {system: {'==squads': squads}});
    await BladesHelpers.tryUpdate(squadFull, {system: {'==faction': factionFull.uuid}});
    await BladesHelpers.addRelationship(squadFull, factionFull, true);

    // Add NPCs as belonging to the faction
    for (let member of Object.values(squadFull.system.members)) {
      let memberFull = BladesHelpers.resolveActor(member);
      if (memberFull?.type == 'npc')
        await BladesHelpers.addFactionNPC(factionFull, memberFull, false);
    }
  }

  static _factionSquadCompareFunc(a, b) {
    if (a.system.tier.value != b.system.tier.value)                return b.system.tier.value - a.system.tier.value;
    else if (a.system.hold == 'weak' && b.system.hold == 'strong') return 1;
    else if (a.system.hold == 'strong' && b.system.hold == 'weak') return -1;
    return a.name.localeCompare(b.name, 'en-US');
  }

  // Removes a faction's squad and removes the squad from the faction's squad list
  static async removeFactionSquad(squadFull) {
    let factionFull = BladesHelpers.resolveActor(squadFull.system.faction);
    if (factionFull) {
      await BladesHelpers.removeRelationship(squadFull, factionFull, true);
      let factionSquadsArray = Object.values(factionFull.system.squads);
      factionSquadsArray.splice(factionSquadsArray.map(e => e.uuid).indexOf(squadFull.uuid), 1);
      let newFactionSquads = Object.assign({}, factionSquadsArray);
      await BladesHelpers.tryUpdate(factionFull, {system: {'==squads': newFactionSquads}});

      // Remove NPCs from the faction
      for (let member of Object.values(squadFull.system.members)) {
        let memberFull = BladesHelpers.resolveActor(member);
        if (memberFull?.type == 'npc')
          await BladesHelpers.removeFactionNPC(memberFull);
      }
    }
    await BladesHelpers.tryUpdate(squadFull, {system: {'==faction': null}});
  }

  /* -------------------------------------------- */

  static async addRegionOwner(ownerFull, regionFull, fromOwner) {
    // Check current owner is not BladesHelpers faction
    if (regionFull.system.owner === ownerFull.uuid) {
      BladesHelpers.printSameObjectError(fromOwner, ownerFull.type, 'region');
      return;
    }

    // Check for previous owner and delete it
    if (regionFull.system.owner)
      await BladesHelpers.removeRegionOwner(regionFull);

    // Add as owner
    if (ownerFull.type == 'faction') {
      let regions = ownerFull.system.regions;
      regions.push({uuid: regionFull.uuid});
      regions = BladesHelpers.sortObjects(regions, BladesHelpers.fetchSimpleData, BladesHelpers._simpleCompareFunc, BladesHelpers.rebuildSimplesFromData);
      await BladesHelpers.tryUpdate(ownerFull, {system: {'==regions': regions}});
    }
    await BladesHelpers.tryUpdate(regionFull, {system: {'==owner': ownerFull.uuid}});
  }

  static async removeRegionOwner(regionFull) {
    const ownerFull = BladesHelpers.resolveActor(regionFull.system.owner);
    if (ownerFull && ownerFull.type == 'faction') {
      let factionRegions = ownerFull.system.regions;
      factionRegions.splice(factionRegions.findIndex(s => s.uuid === regionFull.uuid), 1);
      await BladesHelpers.tryUpdate(ownerFull, {system: {'==regions': factionRegions}});
    }
    await BladesHelpers.tryUpdate(regionFull, {system: {'==owner': null}});
  }

  /* -------------------------------------------- */

  static async addRelationship(ownerFull, entityFull, recursive = false) {
    let relationships = ownerFull.system.relationships;
    let squads = ownerFull.system.squads;

    // Check if not currently in the relationship table
    if (Object.values(relationships).map(e => e.uuid).indexOf(entityFull.uuid) >= 0) {
      ui.notifications.info(game.i18n.localize(`BITD.log.info.Same${game.i18n.localize('TYPES.Actor.' + ownerFull.type)}Relationship`));
      return;
    }
    // Check if not currently in the squads table
    if (squads && Object.values(squads).map(e => e.uuid).indexOf(entityFull.uuid) >= 0) {
      ui.notifications.info(game.i18n.localize(`BITD.log.info.Owned${game.i18n.localize('TYPES.Actor.' + ownerFull.type)}Relationship`));
      return;
    }

    // Add new relationship
    let relationship = {uuid: entityFull.uuid, status: 0, collapsed: false};
    if (ownerFull.type == 'crew' || entityFull.type == 'crew')
      relationship.trust = 5;
    relationships[Object.entries(relationships).length] = relationship;
    relationships = Object.assign({}, BladesHelpers.sortObjects(relationships, BladesHelpers.fetchRelationshipData, BladesHelpers._relationshipCompareFunc, BladesHelpers.rebuildRelationshipListFromData));

    // Update the relationship data
    await BladesHelpers.tryUpdate(ownerFull, {system: {'==relationships': relationships}});
    if (['faction', 'crew'].includes(entityFull.type) && !recursive)
      await BladesHelpers.addRelationship(entityFull, ownerFull, true);
  }

  static reverseRelationship(relationship, ownerFull) {
    relationship = foundry.utils.deepClone(relationship);
    relationship.uuid = ownerFull.uuid;
    relationship.name = ownerFull.name;
    return relationship;
  }

  static fetchRelationship(ownerFull, entityFull) {
    let relationship = ownerFull.system.squads ? Object.values(ownerFull.system.squads).find(r => r.uuid == entityFull.uuid) : null;
    if (!relationship)
      relationship = ownerFull.system.relationships ? Object.values(ownerFull.system.relationships).find(r => r.uuid == entityFull.uuid) : null;
    return relationship;
  }

  static fetchAllRelationships(entityFull, forceFactionSearch, raw) {
    let output = [];
    if (entityFull.type == 'crew' && !forceFactionSearch)
      for (let relationship of Object.values(entityFull.system.relationships))
        output.push(raw ? relationship : { owner: relationship.uuid, status: relationship.status });
    else
      for (let faction of game.actors.filter(e => e.type == 'faction')) {
        let factionFull = BladesHelpers.resolveActor(faction.uuid);
        let relationship = BladesHelpers.fetchRelationship(factionFull, entityFull);
        if (relationship)
          output.push(raw ? BladesHelpers.reverseRelationship(relationship, factionFull) : { owner: factionFull.uuid, status: relationship.status });
      }
    return output;
  }

  static fetchRelationshipData(relationships) {
    let relationshipList = {};
    let keyShift = 0;
    for (let [key, relationship] of Object.entries(relationships)) {
      let entityFull = foundry.utils.deepClone(BladesHelpers.resolveActor(relationship.uuid));
      if (!entityFull) {
        keyShift--;
        continue;
      }
      key = Number(key) + keyShift;
      relationshipList[key] = {
        uuid: entityFull.uuid,
        img: entityFull.img,
        name: entityFull.name,
        type: entityFull.type,
        system: {
          status: relationship.status,
          trust: relationship.trust,
          beliefs: relationship.beliefs,
          faction: entityFull.system.faction,
          crew: entityFull.system.crew,
          squads: entityFull.system.squads,
          patron: false,
          relationshipId: key,
          collapsed: relationship.collapsed,
          is_player_crew: entityFull.system.is_player_crew
        }
      };
    }
    return relationshipList;
  }

  static fetchFullAndRelativeRelationshipsData(ownerFull, relationships) {
    let relationshipsFull = BladesHelpers.fetchRelationshipData(relationships);

    // Fetch list of direct children instead of an empty object
    let directRelationshipsFull = [];
    for (let relationshipFull of Object.values(relationshipsFull)) {
      relationshipFull.system.children = [];
      let isChild = false;
      if (relationshipFull.system.faction && !relationshipFull.system.crew) {
        let parentIndex = directRelationshipsFull.map(e => e.uuid).indexOf(relationshipFull.system.faction);
        if (parentIndex >= 0) {
          directRelationshipsFull[parentIndex].system.children.push(relationshipFull);
          isChild = true;
        }
      }

      // In case of character/npc: check if squad is a direct children, or embedded in a faction
      if (relationshipFull.system.crew) {
        let parentIndex = directRelationshipsFull.map(e => e.uuid).indexOf(relationshipFull.system.crew);
        if (parentIndex >= 0) {
          directRelationshipsFull[parentIndex].system.children.push(relationshipFull);
          isChild = true;
        }

        for (let factionRelationshipFull of directRelationshipsFull.filter(e => e.type == 'faction')) {
          let squadRelationshipFull = factionRelationshipFull.system.children.find(r => r.uuid == relationshipFull.system.crew);
          let squadFactionIndex = Object.values(factionRelationshipFull.system.squads).map(e => e.uuid).indexOf(relationshipFull.system.crew);
          if (squadRelationshipFull) {
            squadRelationshipFull.system.children.push(relationshipFull);
            isChild = true;
          } else if (squadFactionIndex >= 0) {
            factionRelationshipFull.system.children.push(relationshipFull);
            isChild = true;
          }
        }
      }

      if (!isChild)
        if (relationshipFull.uuid == ownerFull.system.faction) {
          relationshipFull.system.patron = true;
          directRelationshipsFull.unshift(relationshipFull);
        } else
          directRelationshipsFull.push(relationshipFull);
    }

    return [relationshipsFull, directRelationshipsFull];
  }

  static _relationshipCompareFunc(a, b) {
    if      (a.type == 'faction'   && b.type != 'faction')   return -1;
    else if (a.type != 'faction'   && b.type == 'faction')   return 1;
    else if (a.type == 'crew'      && b.type != 'crew')      return -1;
    else if (a.type != 'crew'      && b.type == 'crew')      return 1;
    else if (a.type == 'character' && b.type != 'character') return -1;
    else if (a.type != 'character' && b.type == 'character') return 1;
    return a.name.localeCompare(b.name, 'en-US');
  }

  static rebuildRelationshipListFromData(relationshipsFull) {
    let relationships = {};
    for (let [key, relationshipFull] of Object.entries(relationshipsFull))
      relationships[key] = {
        uuid: relationshipFull.uuid,
        name: relationshipFull.name,
        status: relationshipFull.system ? relationshipFull.system.status : relationshipFull.status,
        trust: relationshipFull.system ? relationshipFull.system.trust : relationshipFull.trust,
        beliefs: relationshipFull.system ? relationshipFull.system.beliefs : relationshipFull.beliefs,
        collapsed: relationshipFull.system ? relationshipFull.system.collapsed : relationshipFull.collapsed
      };
    return relationships;
  }

  static async removeRelationship(ownerFull, entityFull, recursive = false) {
    let relationshipFull = Object.values(ownerFull.system.relationships).find(r => r.uuid == entityFull.uuid);
    if (!relationshipFull)
      return;

    // Remove the relationship from the table
    let relationshipsArray = Object.values(ownerFull.system.relationships);
    relationshipsArray.splice(relationshipsArray.indexOf(relationshipFull), 1);
    let newRelationships = Object.assign({}, relationshipsArray);

    // Update the data
    await BladesHelpers.tryUpdate(ownerFull, {system: {'==relationships': newRelationships}});
    if (['faction', 'crew'].includes(entityFull.type) && !recursive)
      await BladesHelpers.removeRelationship(entityFull, ownerFull, true);
  }

  /* -------------------------------------------- */

  static async addRegionNPC(regionFull, npcFull, fromRegion) {
    // Check NPC is not in BladesHelpers region
    if (npcFull.system.region === regionFull.uuid) {
      BladesHelpers.printSameObjectError(fromRegion, 'region', 'npc');
      return;
    }

    // Check for previous owner and delete it
    if (npcFull.system.region)
      await BladesHelpers.removeNPCRegion(npcFull);

    // Add as owner
    let npcs = regionFull.system.npcs;
    npcs.push({uuid: npcFull.uuid});
    npcs = BladesHelpers.sortObjects(npcs, BladesHelpers.fetchSimpleData, BladesHelpers._simpleCompareFunc, BladesHelpers.rebuildSimplesFromData);
    await BladesHelpers.tryUpdate(regionFull, {system: {'==npcs': npcs}});
    await BladesHelpers.tryUpdate(npcFull, {system: {'==region': regionFull.uuid}});
  }

  static async removeNPCRegion(npcFull) {
    let regionFull = BladesHelpers.resolveActor(npcFull.system.region);
    if (regionFull) {
      let regionNPCs = regionFull.system.npcs;
      regionNPCs.splice(regionNPCs.findIndex(s => s.uuid === npcFull.uuid), 1);
      await BladesHelpers.tryUpdate(regionFull, {system: {'==npcs': regionNPCs}});
    }
    await BladesHelpers.tryUpdate(npcFull, {system: {'==region': null}});
  }

  /* -------------------------------------------- */

  static async addFactionNPC(factionFull, npcFull, fromFaction, allowError) {
    // Check NPC is not in BladesHelpers faction
    if (npcFull.system.faction === factionFull.uuid) {
      if (!allowError)
        BladesHelpers.printSameObjectError(fromFaction, 'faction', 'npc');
      return;
    }

    // Check for previous owner and delete it
    if (npcFull.system.faction)
      await BladesHelpers.removeFactionNPC(npcFull);

    // Add as owner
    let npcs = factionFull.system.npcs;
    npcs.push({uuid: npcFull.uuid});
    npcs = BladesHelpers.sortObjects(npcs, BladesHelpers.fetchSimpleData, BladesHelpers._simpleCompareFunc, BladesHelpers.rebuildSimplesFromData);
    await BladesHelpers.tryUpdate(factionFull, {system: {'==npcs': npcs}});
    await BladesHelpers.tryUpdate(npcFull, {system: {'==faction': factionFull.uuid}});
  }

  static async addFactionNPCs(factionFull, npcsFull, allowError) {
    for (let npcFull of npcsFull)
      await BladesHelpers.addFactionNPC(factionFull, npcFull, true, allowError);
  }

  static async removeFactionNPC(npcFull) {
    let factionFull = BladesHelpers.resolveActor(npcFull.system.faction);
    if (factionFull) {
      let factionNPCs = factionFull.system.npcs;
      factionNPCs.splice(factionNPCs.findIndex(s => s.uuid === npcFull.uuid), 1);
      await BladesHelpers.tryUpdate(factionFull, {system: {'==npcs': factionNPCs}});
    }
    await BladesHelpers.tryUpdate(npcFull, {system: {'==faction': null}});
  }

  /* -------------------------------------------- */

  static async addFactionVehicle(factionFull, vehicleFull, fromFaction) {
    // Check NPC is not in BladesHelpers faction
    if (vehicleFull.system.faction === factionFull.uuid) {
      BladesHelpers.printSameObjectError(fromFaction, 'faction', 'vehicle');
      return;
    }

    // Check for previous owner and delete it
    if (vehicleFull.system.faction)
      await BladesHelpers.removeFactionVehicle(vehicleFull);

    // Add as owner
    let vehicles = factionFull.system.vehicles;
    vehicles.push({uuid: vehicleFull.uuid});
    vehicles = BladesHelpers.sortObjects(vehicles, BladesHelpers.fetchSimpleData, BladesHelpers._simpleCompareFunc, BladesHelpers.rebuildSimplesFromData);
    await BladesHelpers.tryUpdate(factionFull, {system: {'==vehicles': vehicles}});
    await BladesHelpers.tryUpdate(vehicleFull, {system: {'==faction': factionFull.uuid}});
  }

  static async removeFactionVehicle(vehicleFull) {
    let factionFull = BladesHelpers.resolveActor(vehicleFull.system.faction);
    if (factionFull) {
      let factionVehicles = factionFull.system.vehicles;
      factionVehicles.splice(factionVehicles.findIndex(s => s.uuid === vehicleFull.uuid), 1);
      await BladesHelpers.tryUpdate(factionFull, {system: {'==vehicles': factionVehicles}});
    }
    await BladesHelpers.tryUpdate(vehicleFull, {system: {'==faction': null}});
  }

  /* -------------------------------------------- */

  static fetchSimpleData(simpleObjs, extraFields = [], compareFunc = undefined) {
    let simpleObjsFull = [];
    for (let simpleObj of Object.values(simpleObjs)) {
      let simpleObjFull = BladesHelpers.resolveActor(simpleObj.uuid);
      if (!simpleObjFull)
        continue;
      for (let extraField of extraFields)
        simpleObjFull.system[extraField] = simpleObj[extraField];
      simpleObjsFull.push(simpleObjFull);
    }
    if (compareFunc)
      simpleObjsFull = simpleObjsFull.sort(compareFunc);
    return simpleObjsFull;
  }

  static _simpleCompareFunc(a, b) {
    return a.name.localeCompare(b.name, 'en-US');
  }

  static rebuildSimplesFromData(simpleObjsFull, extraFields = []) {
    let simpleObjs = [];
    for (let simpleObjFull of Object.values(simpleObjsFull)) {
      let simpleObj = {uuid: simpleObjFull.uuid};
      for (let extraField of extraFields)
        simpleObj[extraField] = simpleObjFull.system[extraField];
      simpleObjs.push(simpleObj);
    }
    return simpleObjs;
  }
}
