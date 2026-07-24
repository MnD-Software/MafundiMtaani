import { NairobiMap } from "@/components/nairobi-map";
import { EstateDirectory } from "@/components/estate-directory";

export default function MapPage() {
  return <main className="map-page">
    <div className="map-page-heading"><span className="kicker">Nairobi coverage</span><h1>Help, mapped to your neighbourhood.</h1><p>Explore live artisan supply across Nairobi and its metropolitan service areas. Density is based on verified, currently active professionals.</p></div>
    <NairobiMap />
    <EstateDirectory />
  </main>;
}
