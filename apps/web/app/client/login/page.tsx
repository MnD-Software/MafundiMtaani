import {Suspense} from "react";
import {LoginForm} from "@/components/login-form";
export default function ClientLogin(){return <Suspense><LoginForm portal="client"/></Suspense>}
