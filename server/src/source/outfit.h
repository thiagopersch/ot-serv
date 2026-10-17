////////////////////////////////////////////////////////////////////////
// OpenTibia - an opensource roleplaying game
////////////////////////////////////////////////////////////////////////
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.
////////////////////////////////////////////////////////////////////////

#ifndef __OUTFIT__
#define __OUTFIT__

#include "otsystem.h"
#include "enums.h"

class Player;

#define OUTFITS_MAX_NUMBER 100
#define EXT_OUTFIT_MAX_NUMBER 100

enum AddonRequirement_t
{
	REQUIREMENT_NONE = 0,
	REQUIREMENT_FIRST,
	REQUIREMENT_SECOND,
	REQUIREMENT_BOTH,
	REQUIREMENT_ANY
};

struct Outfit
{
	Outfit()
	{
		memset(skills, 0, sizeof(skills));
		memset(skillsPercent, 0, sizeof(skillsPercent));
		memset(stats, 0 , sizeof(stats));
		memset(statsPercent, 0, sizeof(statsPercent));

		memset(absorb, 0, sizeof(absorb));
		memset(reflect[REFLECT_PERCENT], 0, sizeof(reflect[REFLECT_PERCENT]));
		memset(reflect[REFLECT_CHANCE], 0, sizeof(reflect[REFLECT_CHANCE]));

		isDefault = true;
		requirement = REQUIREMENT_BOTH;
		isPremium = manaShield = invisible = regeneration = false;
		outfitId = lookType = addons = accessLevel = 0;
		speed = healthGain = healthTicks = manaGain = manaTicks = conditionSuppressions = 0;
	}

	bool isDefault, isPremium, manaShield, invisible, regeneration;
	AddonRequirement_t requirement;
	int16_t absorb[COMBAT_LAST + 1], reflect[REFLECT_LAST + 1][COMBAT_LAST + 1];

	uint16_t accessLevel, addons;
	int32_t skills[SKILL_LAST + 1], skillsPercent[SKILL_LAST + 1], stats[STAT_LAST + 1], statsPercent[STAT_LAST + 1],
		speed, healthGain, healthTicks, manaGain, manaTicks, conditionSuppressions;

	uint32_t outfitId, lookType;
	std::string name, storageId, storageValue;
};

struct WingType
{
	uint16_t id;
	uint16_t lookType;
	std::string name;
	std::string storageId;
	std::string storageValue;
	bool isPremium;

	WingType() { id = lookType = 0; isPremium = false; }
};

struct AuraType
{
	uint16_t id;
	uint16_t lookType;
	std::string name;
	std::string storageId;
	std::string storageValue;
	bool isPremium;
	int16_t posX;
	int16_t posY;

	AuraType() { id = lookType = 0; isPremium = false; posX = 0; posY = 0; }
};

struct ShaderType
{
	uint16_t id;
	std::string shaderName;
	std::string displayName;
	std::string storageId;
	std::string storageValue;
	bool isPremium;

	ShaderType() { id = 0; isPremium = false; }
};

struct BarType
{
	uint16_t id;
	std::string imagePath;
	std::string name;
	std::string storageId;
	std::string storageValue;
	bool isPremium;

	BarType() { id = 0; isPremium = false; }
};

typedef std::list<Outfit> OutfitList;
typedef std::map<uint32_t, Outfit> OutfitMap;
typedef std::map<uint32_t, WingType> WingMap;
typedef std::map<uint32_t, AuraType> AuraMap;
typedef std::map<uint32_t, ShaderType> ShaderMap;
typedef std::map<uint32_t, BarType> BarMap;

class Wings
{
	public:
		virtual ~Wings() {}
		static Wings* getInstance()
		{
			static Wings instance;
			return &instance;
		}

		bool loadFromXml();

		const WingMap& getWings() const { return wingMap; }
		bool getWing(uint16_t id, WingType& wing);
		WingType* getWingByLookType(uint16_t lookType);

		bool playerHasWing(const Player* player, uint16_t wingId) const;

	private:
		Wings() {}
		WingMap wingMap;
};

class Auras
{
	public:
		virtual ~Auras() {}
		static Auras* getInstance()
		{
			static Auras instance;
			return &instance;
		}

		bool loadFromXml();

		const AuraMap& getAuras() const { return auraMap; }
		bool getAura(uint16_t id, AuraType& aura);
		AuraType* getAuraByLookType(uint16_t lookType);

		bool playerHasAura(const Player* player, uint16_t auraId) const;

	private:
		Auras() {}
		AuraMap auraMap;
};

class Shaders
{
	public:
		virtual ~Shaders() {}
		static Shaders* getInstance()
		{
			static Shaders instance;
			return &instance;
		}

		bool loadFromXml();

		const ShaderMap& getShaders() const { return shaderMap; }
		bool getShader(uint16_t id, ShaderType& shader);
		uint16_t getShaderByName(const std::string& shaderName) const;

		bool playerHasShader(const Player* player, uint16_t shaderId) const;

	private:
		Shaders() {}
		ShaderMap shaderMap;
};

class Bars
{
	public:
		virtual ~Bars() {}
		static Bars* getInstance()
		{
			static Bars instance;
			return &instance;
		}

		bool loadFromXml();

		const BarMap& getHealthBars() const { return healthBarMap; }
		const BarMap& getManaBars() const { return manaBarMap; }
		bool getHealthBar(uint16_t id, BarType& bar);
		bool getManaBar(uint16_t id, BarType& bar);

		bool playerHasBar(const Player* player, uint16_t barId, bool isHealth) const;

	private:
		Bars() {}
		BarMap healthBarMap;
		BarMap manaBarMap;
};

class Outfits
{
	public:
		virtual ~Outfits() {}
		static Outfits* getInstance()
		{
			static Outfits instance;
			return &instance;
		}

		bool loadFromXml();
		bool parseOutfitNode(xmlNodePtr p);

		const OutfitMap& getOutfits(uint16_t sex) {return outfitsMap[sex];}

		bool getOutfit(uint32_t outfitId, uint16_t sex, Outfit& outfit);
		bool getOutfit(uint32_t lookType, Outfit& outfit);

		bool addAttributes(uint32_t playerId, uint32_t outfitId, uint16_t sex, uint16_t addons);
		bool removeAttributes(uint32_t playerId, uint32_t outfitId, uint16_t sex);

		uint32_t getOutfitId(uint32_t lookType);

		int16_t getOutfitAbsorb(uint32_t lookType, uint16_t sex, CombatType_t combat);
		int16_t getOutfitReflect(uint32_t lookType, uint16_t sex, CombatType_t combat);

	private:
		Outfits() {}

		OutfitList allOutfits;
		std::map<uint16_t, OutfitMap> outfitsMap;
};
#endif
