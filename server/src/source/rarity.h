////////////////////////////////////////////////////////////////////////
// OpenTibia - an opensource roleplaying game
////////////////////////////////////////////////////////////////////////
// Item rarity system (Comum -> Mitico)
// Configuration: data/XML/rarity.xml
////////////////////////////////////////////////////////////////////////

#ifndef __RARITY__
#define __RARITY__
#include "otsystem.h"

#define RARITY_ATTRIBUTE "rarity"
#define RARITY_CUSTOM_ATTRIBUTE_KEY 1
#define RARITY_DROP_BASE 100000

class Item;

struct RarityTier
{
	RarityTier(): bonus(0), dropChance(0) {}

	std::string name, nameLatin, color;
	int32_t bonus, dropChance;
};

struct RarityMaterial
{
	RarityMaterial(): itemId(0), count(0) {}

	uint16_t itemId;
	uint32_t count;
};
typedef std::vector<RarityMaterial> RarityMaterialList;

struct RarityStep
{
	RarityStep(): chance(100) {}

	int32_t chance;
	RarityMaterialList materials;
};
typedef std::map<int32_t, RarityStep> RarityStepMap;

struct RarityGroup
{
	RarityGroup(): maxRarity(0), drop(true), failDowngrade(false) {}

	std::string name, category;
	int32_t maxRarity;
	bool drop, failDowngrade;
	RarityStepMap steps;
	std::vector<uint16_t> items;
};

typedef std::vector<RarityTier> RarityTierList;
typedef std::vector<RarityGroup> RarityGroupList;
typedef std::map<uint16_t, size_t> RarityItemMap;

class RarityManager
{
	public:
		RarityManager(): enabled(false), guaranteeMultiplier(10) {}
		virtual ~RarityManager() {}

		bool loadFromXml();
		bool reload();

		bool isEnabled() const {return enabled;}
		uint32_t getGuaranteeMultiplier() const {return guaranteeMultiplier;}
		int32_t getMaxTier() const {return tiers.empty() ? 0 : (int32_t)tiers.size() - 1;}

		const RarityTierList& getTiers() const {return tiers;}
		const RarityGroupList& getGroups() const {return groups;}

		const RarityTier* getTier(int32_t rarity) const;
		const RarityGroup* getGroup(uint16_t itemId) const;
		double getMultiplier(int32_t rarity) const;
		int32_t applyBonus(int32_t value, int32_t rarity) const;

		// sorteia a raridade de um item recem-criado (loot, baus, recompensas)
		int32_t rollRarity(uint16_t itemId, int32_t bonusPercent = 0) const;
		int32_t applyRoll(Item* item, int32_t bonusPercent = 0) const;

		std::string getDescription(int32_t rarity) const;

	protected:
		void clear();

		bool enabled;
		uint32_t guaranteeMultiplier;

		RarityTierList tiers;
		RarityGroupList groups;
		RarityItemMap itemMap;
};

extern RarityManager g_rarity;
#endif
