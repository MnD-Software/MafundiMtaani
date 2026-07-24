import { NairobiMap } from "@/components/nairobi-map";
import { nairobiEstates } from "@/lib/data";

export default function MapPage() {
  return <main className="map-page">
    <div className="map-page-heading"><span className="kicker">Nairobi coverage</span><h1>Help, mapped to your neighbourhood.</h1><p>Explore live artisan supply across Nairobi and its metropolitan service areas. Density is based on verified, currently active professionals.</p></div>
    <NairobiMap />
    <section className="estate-directory"><div><span className="kicker">Service coverage</span><h2>All supported estates</h2></div><div className="estate-cloud">{nairobiEstates.map((estate) => <a key={estate} href={`/post-job?area=${encodeURIComponent(estate)}`}>{estate}</a>)}</div></section>
  </main>;
}
