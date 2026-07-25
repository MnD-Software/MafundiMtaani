import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Clock3, MessageCircle, ShieldCheck, Star } from "lucide-react";

type Artisan = { id:string; name:string; avatar_url:string; years_experience:number; trade:string; area:string; bio:string; skills:string[]; rating:number; completed_jobs:number; verified:boolean; available:boolean };
type Portfolio={id:string;title:string;description:string;file_url:string};

export default async function ArtisanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const apiUrl = process.env.API_URL || "http://127.0.0.1:8010";
  const response = await fetch(`${apiUrl}/v1/artisans/${id}`, { cache:"no-store" });
  if (!response.ok) notFound();
  const artisan: Artisan = await response.json();
  const portfolioResponse=await fetch(`${apiUrl}/v1/artisans/${id}/portfolio`,{cache:"no-store"});
  const portfolio:Portfolio[]=portfolioResponse.ok?await portfolioResponse.json():[];
  const initials = artisan.name.split(" ").map((part) => part[0]).join("").slice(0,2);
  return <main className="profile-shell">
    <Link className="back-link" href="/artisans"><ArrowLeft size={17}/>All artisans</Link>
    <section className="profile-hero">
      <div className="profile-image profile-solid">{artisan.avatar_url?<img src={artisan.avatar_url} alt={`${artisan.name}, ${artisan.trade}`}/>:<><strong>{initials}</strong><small>{artisan.trade}</small></>}<span><span/>{artisan.available ? "Available now" : "Currently offline"}</span></div>
      <div className="profile-intro"><div className="eyebrow">Verified professional</div><h1>{artisan.name}<BadgeCheck size={27} fill="#147d64"/></h1><p>{artisan.trade} · {artisan.area}, Nairobi</p><div className="profile-stats"><span><strong><Star size={17}/>{artisan.rating || "New"}</strong>Verified rating</span><span><strong>{artisan.completed_jobs}</strong>Mafundi projects</span><span><strong>{artisan.years_experience}</strong>Years&apos; experience</span></div><div className="skill-list">{artisan.skills.map((skill) => <span key={skill}>{skill}</span>)}</div></div>
      <aside className="booking-card"><span className="kicker">Work with this professional</span><h3>Request a transparent quote</h3><p><Clock3 size={17}/>{artisan.available ? "Accepting new jobs" : "Responses may take longer"}</p><p><ShieldCheck size={17}/>Mafundi work guarantee</p><Link className="button button-dark button-wide" href={`/post-job?artisan=${artisan.id}`}>Request a quote</Link><Link href={`/contact-artisan?id=${artisan.id}&name=${encodeURIComponent(artisan.name)}&trade=${encodeURIComponent(artisan.trade)}`} className="button button-outline button-wide"><MessageCircle size={17}/>Send a message</Link></aside>
    </section>
    <section className="profile-content"><article><h2>About {artisan.name.split(" ")[0]}</h2><p>{artisan.bio || "This professional has not added a public biography yet."}</p><h2>Trust passport</h2><div className="expect-grid"><span><BadgeCheck/>Identity verified</span><span><ShieldCheck/>Approval completed</span>{artisan.completed_jobs>=10&&<span><Star/>Experienced professional</span>}{artisan.rating>=4.8&&artisan.completed_jobs>=5&&<span><Star/>Top rated</span>}</div></article><aside><div className="review-highlight"><Star/><strong>{artisan.completed_jobs ? "Reviews are shown only after completed marketplace jobs." : "No verified reviews yet."}</strong></div></aside></section>
    {portfolio.length>0&&<section className="public-portfolio"><span className="kicker">Proof of craft</span><h2>Recent work</h2><div className="portfolio-grid">{portfolio.map(item=><article key={item.id}>{item.file_url&&<img src={item.file_url} alt={item.title}/>}<strong>{item.title}</strong><p>{item.description}</p></article>)}</div></section>}
  </main>;
}
