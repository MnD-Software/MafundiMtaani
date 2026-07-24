import { JobRoom } from "@/components/job-room";

export default async function JobRoomPage({ params }:{ params:Promise<{id:string}> }) {
  return <JobRoom jobId={(await params).id}/>;
}
