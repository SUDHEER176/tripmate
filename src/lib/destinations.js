import fushimiInari from "@/assets/images/places/fushimi-inari.jpg";
import kinkakuJi from "@/assets/images/places/kinkaku-ji.jpg";
import nishikiMarket from "@/assets/images/places/nishiki-market.jpg";

/** A themed view of a destination, shown when the user filters by that theme. */

export const HIGHLIGHT_LABELS = {
  culture: "Culture",
  food: "Must try",
  nature: "Nature",
  relaxation: "Slow travel",
  history: "History",
};

const commons = (path) =>
  `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}`;

export const destinations = [
  {
    name: "Kyoto",
    country: "Japan",
    blurb: "Temples, tea houses, and lantern-lit alleys.",
    vibe: "Culture & gardens",
    lat: 35.0116,
    lng: 135.7681,
    image:
      "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
    avgDaily: 12000,
    tags: ["culture", "food", "history"],
    highlights: {
      food: {
        caption: "Matcha sweets, yudofu and grilled skewers at Nishiki Market",
        image: nishikiMarket,
      },
      culture: {
        caption:
          "Fushimi Inari’s thousand torii gates, tea ceremonies and Gion",
        image: fushimiInari,
      },
      history: {
        caption: "Kinkaku-ji, the Golden Pavilion, and 1,600 temples",
        image: kinkakuJi,
      },
    },
  },
  {
    name: "Lisbon",
    country: "Portugal",
    blurb: "Trams, tiled streets, and Atlantic sunsets.",
    vibe: "City & coastline",
    lat: 38.7223,
    lng: -9.1393,
    image:
      "https://images.unsplash.com/photo-1536663815808-535e2280d2c2?auto=format&fit=crop&w=1200&q=80",
    avgDaily: 8500,
    tags: ["food", "culture", "nightlife"],
    highlights: {
      food: {
        caption: "Pastel de nata, grilled sardines and bifana",
        image: commons(
          "b/b3/Manteigaria_pastel_de_nata_%2829108853478%29.jpg/1280px-Manteigaria_pastel_de_nata_%2829108853478%29.jpg",
        ),
        credit: "Kent Wang · CC BY-SA 2.0",
      },
      culture: {
        caption: "Tram 28 through Alfama and fado in old taverns",
        image: commons(
          "9/9f/Tram_28_in_Alfama_%28Lissabon_2016%29_%2826029557961%29.jpg/1280px-Tram_28_in_Alfama_%28Lissabon_2016%29_%2826029557961%29.jpg",
        ),
        credit: "Paul Arps · CC BY 2.0",
      },
    },
  },
  {
    name: "Bali",
    country: "Indonesia",
    blurb: "Rice terraces, temples, and slow mornings.",
    vibe: "Nature & rest",
    lat: -8.4095,
    lng: 115.1889,
    image:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80",
    avgDaily: 7000,
    tags: ["nature", "relaxation", "adventure"],
    highlights: {
      nature: {
        caption: "Tegallalang rice terraces, waterfalls and volcano sunrises",
        image: commons(
          "8/8a/Rice_terraces%2C_Bali.jpg/1280px-Rice_terraces%2C_Bali.jpg",
        ),
        credit: "Vyacheslav Argenberg · CC BY 4.0",
      },
      relaxation: {
        caption: "Lake temples, yoga retreats and slow mornings in Ubud",
        image:
          "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80",
      },
    },
  },
  {
    name: "Marrakech",
    country: "Morocco",
    blurb: "Souks, riads, and spice-scented courtyards.",
    vibe: "Markets & history",
    lat: 31.6295,
    lng: -7.9811,
    image:
      "https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1200&q=80",
    avgDaily: 6500,
    tags: ["shopping", "culture", "food"],
    highlights: {
      culture: {
        caption: "Koutoubia Mosque, Jemaa el-Fnaa square and the souks",
        image:
          "https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1200&q=80",
      },
      food: {
        caption: "Slow-cooked tagine, couscous and sweet mint tea",
        image: commons("e/ea/Vegetable_Tagine.jpg/1280px-Vegetable_Tagine.jpg"),
        credit: "Turajski · CC BY-SA 4.0",
      },
    },
  },
  {
    name: "Banff",
    country: "Canada",
    blurb: "Turquoise lakes and mountain air.",
    vibe: "Outdoors",
    lat: 51.1784,
    lng: -115.5708,
    image:
      "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=1200&q=80",
    avgDaily: 14000,
    tags: ["nature", "adventure"],
    highlights: {
      nature: {
        caption: "Moraine Lake, Lake Louise and glacier hikes",
        image:
          "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=1200&q=80",
      },
    },
  },
  {
    name: "Santorini",
    country: "Greece",
    blurb: "Whitewashed cliffs above a volcanic caldera.",
    vibe: "Romance & views",
    lat: 36.3932,
    lng: 25.4615,
    image:
      "https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?auto=format&fit=crop&w=1200&q=80",
    avgDaily: 16000,
    tags: ["relaxation", "food"],
    highlights: {
      relaxation: {
        caption: "Caldera sunsets in Oia and black-sand beaches",
        image:
          "https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?auto=format&fit=crop&w=1200&q=80",
      },
      food: {
        caption: "Greek salad, fava and fresh seafood by the sea",
        image: commons(
          "f/f1/Tomato_Salad_%287846872334%29.jpg/1280px-Tomato_Salad_%287846872334%29.jpg",
        ),
        credit: "Ralph Daily · CC BY 2.0",
      },
    },
  },
  {
    name: "Jaipur",
    country: "India",
    blurb: "Pink palaces, bazaars, and royal courtyards.",
    vibe: "Heritage",
    lat: 26.9124,
    lng: 75.7873,
    image:
      "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1200&q=80",
    avgDaily: 4500,
    tags: ["history", "shopping", "food"],
    highlights: {
      history: {
        caption: "Hawa Mahal, Amber Fort and the City Palace",
        image:
          "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1200&q=80",
      },
      food: {
        caption: "Rajasthani thali, dal baati churma and pyaaz kachori",
        image: commons(
          "8/84/Traditional_Rajasthani_Thali-Jaipur-Rajastan-001.jpg/1280px-Traditional_Rajasthani_Thali-Jaipur-Rajastan-001.jpg",
        ),
        credit: "Kaapeine · CC BY-SA 4.0",
      },
    },
  },
  {
    name: "Hoi An",
    country: "Vietnam",
    blurb: "Lantern rivers and tailor shops.",
    vibe: "Old town",
    lat: 15.8801,
    lng: 108.338,
    // Lanterns on the Thu Bon river (Wikimedia Commons, CC0).
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Hoi_An_-_HoiAn1441.jpg/1280px-Hoi_An_-_HoiAn1441.jpg",
    avgDaily: 5000,
    tags: ["food", "culture", "relaxation"],
    highlights: {
      food: {
        caption: "Cao lầu noodles, bánh mì and white rose dumplings",
        image: commons(
          "4/4e/Cao_l%E1%BA%A7u_H%E1%BB%99i_An_%282024%29.jpg/1280px-Cao_l%E1%BA%A7u_H%E1%BB%99i_An_%282024%29.jpg",
        ),
        credit: "Chainwit. · CC BY 4.0",
      },
      culture: {
        caption: "The lantern-lit old town and the Japanese Covered Bridge",
        image:
          "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Hoi_An_-_HoiAn1441.jpg/1280px-Hoi_An_-_HoiAn1441.jpg",
      },
      relaxation: {
        caption: "An Bang beach and bike rides through the rice fields",
        image: commons(
          "4/40/Playa_An_Bang%2C_Hoi_An%2C_Vietnam_%2839510560665%29.jpg/1280px-Playa_An_Bang%2C_Hoi_An%2C_Vietnam_%2839510560665%29.jpg",
        ),
        credit: "Edgardo W. Olivera · CC BY 2.0",
      },
    },
  },
];

export function findDestination(name) {
  const query = name.trim().toLowerCase();
  return destinations.find((item) => item.name.toLowerCase() === query);
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 10000;
}

export function getDestinationImageUrl(
  destination,
  width = 1200,
  height = 600,
) {
  if (!destination || !destination.trim()) {
    return "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80";
  }

  const destMatch = findDestination(destination);
  if (destMatch?.image) {
    return destMatch.image;
  }

  const cleanDest = destination.trim();
  const seed = hashString(cleanDest);
  const prompt = encodeURIComponent(
    `scenic panoramic view of ${cleanDest}, famous landmark landscape, 4k ultra realistic, travel photography, beautiful lighting`,
  );

  return `https://image.pollinations.ai/prompt/${prompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
}

export const interestOptions = [
  { id: "food", label: "Food" },
  { id: "culture", label: "Culture" },
  { id: "nature", label: "Nature" },
  { id: "nightlife", label: "Nightlife" },
  { id: "shopping", label: "Shopping" },
  { id: "adventure", label: "Adventure" },
  { id: "relaxation", label: "Relaxation" },
  { id: "history", label: "History" },
];
