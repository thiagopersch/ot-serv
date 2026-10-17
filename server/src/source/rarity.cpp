////////////////////////////////////////////////////////////////////////
// OpenTibia - an opensource roleplaying game
////////////////////////////////////////////////////////////////////////
// Item rarity system (Comum -> Mitico)
// Configuration: data/XML/rarity.xml
////////////////////////////////////////////////////////////////////////
#include "otpch.h"
#include <cmath>
#include <libxml/xmlmemory.h>
#include <libxml/parser.h>

#include "rarity.h"
#include "item.h"
#include "tools.h"

RarityManager g_rarity;

static std::string readXMLRawString(xmlNodePtr node, const char* tag)
{
	char* nodeValue = (char*)xmlGetProp(node, (xmlChar*)tag);
	if(!nodeValue)
		return "";

	std::string value = nodeValue;
	xmlFree(nodeValue);
	return value;
}

static void parseRarityItems(xmlNodePtr node, RarityGroup& group)
{
	int32_t intValue;
	if(readXMLInteger(node, "id", intValue))
	{
		group.items.push_back((uint16_t)intValue);
		return;
	}

	int32_t toId;
	if(!readXMLInteger(node, "fromid", intValue) || !readXMLInteger(node, "toid", toId))
	{
		std::clog << "[Warning - RarityManager::loadFromXml] <item> without id or fromid/toid in group " << group.name << std::endl;
		return;
	}

	for(int32_t id = intValue; id <= toId; ++id)
		group.items.push_back((uint16_t)id);
}

static void parseRarityStep(xmlNodePtr node, RarityGroup& group)
{
	int32_t to;
	if(!readXMLInteger(node, "to", to) || to < 1)
	{
		std::clog << "[Warning - RarityManager::loadFromXml] <step> without valid 'to' in group " << group.name << std::endl;
		return;
	}

	RarityStep step;
	int32_t intValue;
	if(readXMLInteger(node, "chance", intValue))
		step.chance = std::max((int32_t)0, std::min((int32_t)100, intValue));

	for(xmlNodePtr m = node->children; m; m = m->next)
	{
		if(xmlStrcmp(m->name, (const xmlChar*)"material"))
			continue;

		RarityMaterial material;
		if(!readXMLInteger(m, "id", intValue) || intValue <= 0)
			continue;

		material.itemId = (uint16_t)intValue;
		material.count = 1;
		if(readXMLInteger(m, "count", intValue) && intValue > 0)
			material.count = (uint32_t)intValue;

		step.materials.push_back(material);
	}

	group.steps[to] = step;
}

void RarityManager::clear()
{
	enabled = false;
	guaranteeMultiplier = 10;
	tiers.clear();
	groups.clear();
	itemMap.clear();
}

bool RarityManager::reload()
{
	clear();
	return loadFromXml();
}

bool RarityManager::loadFromXml()
{
	xmlDocPtr doc = xmlParseFile(getFilePath(FILE_TYPE_XML, "rarity.xml").c_str());
	if(!doc)
	{
		std::clog << "[Warning - RarityManager::loadFromXml] Cannot load rarity.xml, rarity system disabled." << std::endl;
		return false;
	}

	xmlNodePtr root = xmlDocGetRootElement(doc);
	if(xmlStrcmp(root->name, (const xmlChar*)"rarity"))
	{
		std::clog << "[Error - RarityManager::loadFromXml] Malformed rarity.xml" << std::endl;
		xmlFreeDoc(doc);
		return false;
	}

	int32_t intValue;
	std::string strValue;
	enabled = true;
	if(readXMLString(root, "enabled", strValue))
		enabled = booleanString(strValue);

	if(readXMLInteger(root, "guaranteeMultiplier", intValue) && intValue > 0)
		guaranteeMultiplier = (uint32_t)intValue;

	for(xmlNodePtr p = root->children; p; p = p->next)
	{
		if(!xmlStrcmp(p->name, (const xmlChar*)"tiers"))
		{
			std::map<int32_t, RarityTier> tierMap;
			for(xmlNodePtr t = p->children; t; t = t->next)
			{
				if(xmlStrcmp(t->name, (const xmlChar*)"tier") || !readXMLInteger(t, "id", intValue))
					continue;

				RarityTier tier;
				tier.name = readXMLRawString(t, "name");
				if(!readXMLString(t, "name", tier.nameLatin))
					tier.nameLatin = tier.name;

				tier.color = readXMLRawString(t, "color");
				if(tier.color.empty())
					tier.color = "#FFFFFF";

				int32_t tmp;
				if(readXMLInteger(t, "bonus", tmp))
					tier.bonus = tmp;

				if(readXMLInteger(t, "dropChance", tmp))
					tier.dropChance = std::max((int32_t)0, tmp);

				tierMap[intValue] = tier;
			}

			// ids devem ser sequenciais a partir de 0
			for(int32_t i = 0; tierMap.find(i) != tierMap.end(); ++i)
				tiers.push_back(tierMap[i]);

			if(tiers.size() != tierMap.size())
				std::clog << "[Warning - RarityManager::loadFromXml] Tier ids must be sequential starting at 0, some tiers were ignored." << std::endl;
		}
		else if(!xmlStrcmp(p->name, (const xmlChar*)"group"))
		{
			RarityGroup group;
			readXMLString(p, "name", group.name);
			group.category = asLowerCaseString(readXMLRawString(p, "category"));
			if(group.category.empty())
				group.category = "others";

			group.maxRarity = -1;
			if(readXMLInteger(p, "maxRarity", intValue))
				group.maxRarity = intValue;

			if(readXMLString(p, "drop", strValue))
				group.drop = booleanString(strValue);

			if(readXMLString(p, "failDowngrade", strValue))
				group.failDowngrade = booleanString(strValue);

			for(xmlNodePtr c = p->children; c; c = c->next)
			{
				if(!xmlStrcmp(c->name, (const xmlChar*)"item"))
					parseRarityItems(c, group);
				else if(!xmlStrcmp(c->name, (const xmlChar*)"step"))
					parseRarityStep(c, group);
			}

			groups.push_back(group);
		}
	}

	xmlFreeDoc(doc);
	if(tiers.empty())
	{
		RarityTier tier;
		tier.name = tier.nameLatin = "Common";
		tier.color = "#FFFFFF";
		tiers.push_back(tier);
	}

	for(size_t g = 0; g < groups.size(); ++g)
	{
		RarityGroup& group = groups[g];
		if(group.maxRarity < 0 || group.maxRarity > getMaxTier())
			group.maxRarity = getMaxTier();

		for(std::vector<uint16_t>::const_iterator it = group.items.begin(); it != group.items.end(); ++it)
		{
			const ItemType* type = Item::items.getElement(*it);
			if(!type)
				continue;

			// pilhas sao unidas/divididas apenas pelo id, o atributo de raridade se perderia
			if(type->stackable)
			{
				std::clog << "[Warning - RarityManager::loadFromXml] Item " << *it << " is stackable and cannot have rarity, ignored." << std::endl;
				continue;
			}

			if(itemMap.find(*it) != itemMap.end())
			{
				std::clog << "[Warning - RarityManager::loadFromXml] Item " << *it << " is in more than one group, keeping the first one." << std::endl;
				continue;
			}

			itemMap[*it] = g;
		}
	}

	std::clog << ">> Rarity: " << tiers.size() << " tiers, " << groups.size() << " groups, " << itemMap.size() << " items" << (enabled ? "" : " (disabled)") << std::endl;
	return true;
}

const RarityTier* RarityManager::getTier(int32_t rarity) const
{
	if(rarity < 0 || rarity >= (int32_t)tiers.size())
		return NULL;

	return &tiers[rarity];
}

const RarityGroup* RarityManager::getGroup(uint16_t itemId) const
{
	RarityItemMap::const_iterator it = itemMap.find(itemId);
	if(it == itemMap.end())
		return NULL;

	return &groups[it->second];
}

double RarityManager::getMultiplier(int32_t rarity) const
{
	const RarityTier* tier = getTier(rarity);
	if(!tier || rarity <= 0)
		return 1.0;

	return 1.0 + (tier->bonus / 100.0);
}

int32_t RarityManager::applyBonus(int32_t value, int32_t rarity) const
{
	if(rarity <= 0 || value <= 0)
		return value;

	return (int32_t)std::floor(value * getMultiplier(rarity) + 0.5);
}

int32_t RarityManager::rollRarity(uint16_t itemId, int32_t bonusPercent/* = 0*/) const
{
	if(!enabled)
		return 0;

	const RarityGroup* group = getGroup(itemId);
	if(!group || !group->drop)
		return 0;

	// do mais raro para o mais comum: o primeiro sorteio bem-sucedido vence
	for(int32_t r = group->maxRarity; r > 0; --r)
	{
		int32_t chance = tiers[r].dropChance;
		if(chance <= 0)
			continue;

		if(bonusPercent > 0)
			chance = (int32_t)(chance * (1.0 + bonusPercent / 100.0));

		if(random_range(1, RARITY_DROP_BASE) <= chance)
			return r;
	}

	return 0;
}

int32_t RarityManager::applyRoll(Item* item, int32_t bonusPercent/* = 0*/) const
{
	if(!item || item->getRarity() > 0)
		return item ? item->getRarity() : 0;

	int32_t rarity = rollRarity(item->getID(), bonusPercent);
	if(rarity > 0)
		item->setRarity(rarity);

	return rarity;
}

std::string RarityManager::getDescription(int32_t rarity) const
{
	const RarityTier* tier = getTier(rarity);
	if(!tier || rarity <= 0)
		return "";

	std::stringstream s;
	s << "Rarity: " << tier->nameLatin;
	if(tier->bonus)
		s << " (+" << tier->bonus << "%)";

	return s.str();
}
