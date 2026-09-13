// Copyright (c) 2026 RSG-KH | Apache-2.0 License

export interface ZodiacSign {
  symbol: string;
  signName: string;
  element: string;
  planet: string;
  signNameKm: string;
  elementKm: string;
  planetKm: string;
}

export const ZODIAC_SIGNS: Record<string, ZodiacSign> = {
  "ARIES": {
    "symbol": "♈︎",
    "signName": "Aries",
    "element": "Fire",
    "planet": "Mars",
    "signNameKm": "មេស",
    "elementKm": "ភ្លើង",
    "planetKm": "ព្រះអង្គារ"
  },
  "TAURUS": {
    "symbol": "♉︎",
    "signName": "Taurus",
    "element": "Earth",
    "planet": "Venus",
    "signNameKm": "ឧសភ",
    "elementKm": "ដី",
    "planetKm": "ព្រះសុក្រ"
  },
  "GEMINI": {
    "symbol": "♊︎",
    "signName": "Gemini",
    "element": "Air",
    "planet": "Mercury",
    "signNameKm": "មិថុន",
    "elementKm": "ខ្យល់",
    "planetKm": "ព្រះពុធ"
  },
  "CANCER": {
    "symbol": "♋︎",
    "signName": "Cancer",
    "element": "Water",
    "planet": "Moon",
    "signNameKm": "កក្កដា",
    "elementKm": "ទឹក",
    "planetKm": "ព្រះច័ន្ទ"
  },
  "LEO": {
    "symbol": "♌︎",
    "signName": "Leo",
    "element": "Fire",
    "planet": "Sun",
    "signNameKm": "សីហា",
    "elementKm": "ភ្លើង",
    "planetKm": "ព្រះអាទិត្យ"
  },
  "VIRGO": {
    "symbol": "♍︎",
    "signName": "Virgo",
    "element": "Earth",
    "planet": "Mercury",
    "signNameKm": "កញ្ញា",
    "elementKm": "ដី",
    "planetKm": "ព្រះពុធ"
  },
  "LIBRA": {
    "symbol": "♎︎",
    "signName": "Libra",
    "element": "Air",
    "planet": "Venus",
    "signNameKm": "តុលា",
    "elementKm": "ខ្យល់",
    "planetKm": "ព្រះសុក្រ"
  },
  "SCORPIO": {
    "symbol": "♏︎",
    "signName": "Scorpio",
    "element": "Water",
    "planet": "Pluto",
    "signNameKm": "វិច្ឆិកា",
    "elementKm": "ទឹក",
    "planetKm": "ភ្លុយតូ"
  },
  "SAGITTARIUS": {
    "symbol": "♐︎",
    "signName": "Sagittarius",
    "element": "Fire",
    "planet": "Jupiter",
    "signNameKm": "ធ្នូ",
    "elementKm": "ភ្លើង",
    "planetKm": "ព្រះព្រហស្បតិ៍"
  },
  "CAPRICORN": {
    "symbol": "♑︎",
    "signName": "Capricorn",
    "element": "Earth",
    "planet": "Saturn",
    "signNameKm": "មករា",
    "elementKm": "ដី",
    "planetKm": "ព្រះសៅរ៍"
  },
  "AQUARIUS": {
    "symbol": "♒︎",
    "signName": "Aquarius",
    "element": "Air",
    "planet": "Uranus",
    "signNameKm": "កុម្ភៈ",
    "elementKm": "ខ្យល់",
    "planetKm": "អ៊ុយរ៉ានុស"
  },
  "PISCES": {
    "symbol": "♓︎",
    "signName": "Pisces",
    "element": "Water",
    "planet": "Neptune",
    "signNameKm": "មីនា",
    "elementKm": "ទឹក",
    "planetKm": "ណិបទូន"
  }
};

export class Zodiac {
  static forMonthDay(month: number, day: number): ZodiacSign {
    switch (month) {
      case 1: return day <= 19 ? ZODIAC_SIGNS.CAPRICORN : ZODIAC_SIGNS.AQUARIUS;
      case 2: return day <= 18 ? ZODIAC_SIGNS.AQUARIUS : ZODIAC_SIGNS.PISCES;
      case 3: return day <= 20 ? ZODIAC_SIGNS.PISCES : ZODIAC_SIGNS.ARIES;
      case 4: return day <= 19 ? ZODIAC_SIGNS.ARIES : ZODIAC_SIGNS.TAURUS;
      case 5: return day <= 20 ? ZODIAC_SIGNS.TAURUS : ZODIAC_SIGNS.GEMINI;
      case 6: return day <= 20 ? ZODIAC_SIGNS.GEMINI : ZODIAC_SIGNS.CANCER;
      case 7: return day <= 22 ? ZODIAC_SIGNS.CANCER : ZODIAC_SIGNS.LEO;
      case 8: return day <= 22 ? ZODIAC_SIGNS.LEO : ZODIAC_SIGNS.VIRGO;
      case 9: return day <= 22 ? ZODIAC_SIGNS.VIRGO : ZODIAC_SIGNS.LIBRA;
      case 10: return day <= 22 ? ZODIAC_SIGNS.LIBRA : ZODIAC_SIGNS.SCORPIO;
      case 11: return day <= 21 ? ZODIAC_SIGNS.SCORPIO : ZODIAC_SIGNS.SAGITTARIUS;
      case 12: return day <= 21 ? ZODIAC_SIGNS.SAGITTARIUS : ZODIAC_SIGNS.CAPRICORN;
      default: return ZODIAC_SIGNS.CAPRICORN;
    }
  }

  static label(sign: ZodiacSign, khmer: boolean): string {
    if (khmer && sign.signNameKm) {
      return `${sign.symbol} ${sign.signNameKm} (${sign.elementKm} · ${sign.planetKm})`;
    }
    return `${sign.symbol} ${sign.signName} (${sign.element} · ${sign.planet})`;
  }

  static getAnimalDrawable(animalYear: number, compact: boolean = false): string {
    const animals = [
      'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
      'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'
    ];
    const mod = ((animalYear % 12) + 12) % 12;
    const name = animals[mod] || 'rat';
    return `/assets/drawables/zodiac_${name}${compact ? '_400' : ''}.png`;
  }

  static getWesternDrawable(sign: ZodiacSign): string {
    const signKey = sign.signName.toLowerCase();
    return `/assets/drawables/western_zodiac_${signKey}.png`;
  }
}
