export type Artisan = {
  id: string;
  name: string;
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
  "Athi River", "Baba Dogo", "Bahati", "Buruburu", "CBD", "Clay City", "Dagoretti",
  "Dandora", "Donholm", "Eastleigh", "Embakasi", "Fedha", "Garden Estate", "Gigiri",
  "Githurai", "Highridge", "Huruma", "Imara Daima", "Industrial Area", "Jamhuri",
  "Jericho", "Kabete", "Kahawa", "Kahawa Sukari", "Kangemi", "Karen", "Kariobangi",
  "Kasarani", "Kawangware", "Kayole", "Kiambu Road", "Kibera", "Kileleshwa",
  "Kilimani", "Kitengela", "Komarock", "Lang'ata", "Lavington", "Lucky Summer",
  "Makadara", "Maringo", "Mathare", "Mbagathi", "Mlolongo", "Mowlem", "Muthaiga",
  "Mwiki", "Nairobi West", "Ngara", "Ngong", "Ngong Road", "Njiru", "Parklands",
  "Pangani", "Pipeline", "Ridgeways", "Riruta", "Rongai", "Roysambu", "Ruaka",
  "Ruaraka", "Ruai", "South B", "South C", "Spring Valley", "Syokimau", "Thome",
  "Umoja", "Upper Hill", "Utawala", "Westlands", "Zimmerman"
];

export const estateClusters = [
  { name: "Westlands", x: 31, y: 37, artisans: 0, demand: "No live data" },
  { name: "Kilimani", x: 43, y: 57, artisans: 0, demand: "No live data" },
  { name: "Kasarani", x: 67, y: 24, artisans: 0, demand: "No live data" },
  { name: "Embakasi", x: 76, y: 63, artisans: 0, demand: "No live data" },
  { name: "Karen", x: 25, y: 78, artisans: 0, demand: "No live data" },
  { name: "Eastlands", x: 69, y: 50, artisans: 0, demand: "No live data" },
  { name: "CBD", x: 52, y: 49, artisans: 0, demand: "No live data" },
  { name: "Dagoretti", x: 19, y: 57, artisans: 0, demand: "No live data" },
  { name: "Rongai", x: 43, y: 88, artisans: 0, demand: "No live data" },
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
