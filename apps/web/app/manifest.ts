import type { MetadataRoute } from "next";

export default function manifest():MetadataRoute.Manifest{
  return {name:"Mafundi Mtaani",short_name:"Mafundi",description:"Book and manage verified Nairobi artisans.",start_url:"/",display:"standalone",background_color:"#ffffff",theme_color:"#101310",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml"}]};
}
