import { runFeedbackExperiment } from './experiment';
import { parseFeedbackRequest, resultBuffers, type FeedbackReply } from './protocol';
const scope=globalThis as unknown as {onmessage:(e:MessageEvent<unknown>)=>void;postMessage:(v:FeedbackReply,buffers?:Transferable[])=>void};
scope.onmessage=event=>{
  let id=0,key='';
  try{
    const request=parseFeedbackRequest(event.data);id=request.id;key=request.key;
    const result=runFeedbackExperiment(request.experiment,(completed,total,year)=>scope.postMessage({id,key,status:'progress',completed,total,year}));
    scope.postMessage({id,key,status:'ready',result},resultBuffers(result));
  }catch(error){scope.postMessage({id,key,status:'error',error:error instanceof Error?error.message:'Feedback calculation failed.'});}
};
