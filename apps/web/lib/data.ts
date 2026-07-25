export type Artisan = {
  id: string;
  name: string;
  avatarUrl?: string;
  initials: string;
  trade: string;
  area: string;
  rating: number;
  reviews: number;
  jobs: number;
  eta: string;
  price: string;
  color: string;
  verified: boolean;
  featured?: boolean;
  skills: string[];
};

export const nairobiEstates = [
  "Airbase", "Akiba", "Athi River", "Ayany", "Baba Dogo", "Bahati", "Balozi", "Baraka",
  "Bellevue", "Buruburu Phase 1", "Buruburu Phase 2", "Buruburu Phase 3", "Buruburu Phase 4",
  "Buruburu Phase 5", "California", "CBD", "City Cabanas", "City Park", "Clay City",
  "Dagoretti Corner", "Dandora Phase 1", "Dandora Phase 2", "Dandora Phase 3", "Dandora Phase 4",
  "Dandora Phase 5", "Donholm", "Eastleigh Section 1", "Eastleigh Section 2", "Eastleigh Section 3",
  "Embakasi", "Embakasi Village", "Fedha", "Garden Estate", "Gigiri", "Githurai 44",
  "Githurai 45", "Golf Course", "Greenspan", "Highridge", "Huruma", "Imara Daima",
  "Industrial Area", "Jacaranda", "Jamhuri", "Jericho", "Kabete", "Kabiria", "Kahawa",
  "Kahawa Sukari", "Kahawa Wendani", "Kahawa West", "Kamulu", "Kangemi", "Karen",
  "Kariobangi North", "Kariobangi South", "Kasarani", "Kawangware", "Kayole", "Kiamaiko",
  "Kiamumbi", "Kiambu Road", "Kibera", "Kileleshwa", "Kilimani", "Kinoo", "Kitengela",
  "Kitisuru", "Komarock", "Korogocho", "Kyuna", "Laini Saba", "Lang'ata", "Lavington",
  "Loresho", "Lucky Summer", "Makadara", "Makina", "Makongeni", "Maringo", "Mathare",
  "Mbagathi", "Mihango", "Mirema", "Mlango Kubwa", "Mlolongo", "Mountain View", "Mowlem",
  "Mugoya", "Mukuru Kwa Njenga", "Mukuru Kwa Reuben", "Muthaiga", "Mwiki", "Nairobi West",
  "New Kitisuru", "Ngara", "Ngong", "Ngong Road", "Njiru", "Nyayo Estate", "Olympic",
  "Pangani", "Parklands", "Pipeline", "Pumwani", "Ridgeways", "Riruta", "Riverside",
  "Rongai", "Rosslyn", "Roysambu", "Ruaka", "Ruaraka", "Ruai", "Saika", "Savannah",
  "South B", "South C", "Spring Valley", "Sunton", "Syokimau", "Tassia", "Thindigua",
  "Thome", "Umoja", "Umoja 1", "Umoja 2", "Umoja 3", "Upper Hill", "Utawala", "Valley Arcade",
  "Waithaka", "Westlands", "Woodley", "Zimmerman", "Ziwani"
];

export const estateClusters = [
  { name: "Westlands", x: 34, y: 35, artisans: 0, demand: "Building coverage" },
  { name: "Kilimani", x: 43, y: 58, artisans: 0, demand: "Building coverage" },
  { name: "Kasarani", x: 68, y: 25, artisans: 0, demand: "Building coverage" },
  { name: "Embakasi", x: 76, y: 64, artisans: 0, demand: "Building coverage" },
  { name: "Karen", x: 26, y: 78, artisans: 0, demand: "Building coverage" },
  { name: "Umoja", x: 69, y: 51, artisans: 0, demand: "Building coverage" },
  { name: "CBD", x: 52, y: 48, artisans: 0, demand: "Building coverage" },
  { name: "Dagoretti", x: 19, y: 58, artisans: 0, demand: "Building coverage" },
  { name: "Rongai", x: 43, y: 88, artisans: 0, demand: "Building coverage" },
];

export const categories = [
  { name: "Plumbing", icon: "Wrench", tone: "#dff3ea", count: 0 },
  { name: "Electrical", icon: "Zap", tone: "#fff0c9", count: 0 },
  { name: "Carpentry", icon: "Hammer", tone: "#efe1d2", count: 0 },
  { name: "Painting", icon: "Paintbrush", tone: "#e4e9fa", count: 0 },
  { name: "Appliance repair", icon: "Settings", tone: "#f5e4e7", count: 0 },
  { name: "Cleaning", icon: "Sparkles", tone: "#dff0f3", count: 0 },
];

export const artisans: Artisan[] = [];
export const openJobs: Array<{ id: string; title: string; area: string; trade: string; budget: string; distance: string; time: string; urgency: string }> = [];
