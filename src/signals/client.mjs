export async function receiveSignalPage({ page, requestCursor, inbox, fetchAfter, expectedScope, filter = () => true }) {
  const validate = value => {
    if(value.notificationScope!==expectedScope || !Number.isSafeInteger(value.nextCursor) || value.nextCursor<0 || !Array.isArray(value.events))throw Error('ACCOUNT_OR_EVENT_SCOPE_CHANGED');
  };
  validate(page);
  let expected=requestCursor??null;
  const retained=await inbox.snapshot();
  // On reload the server's first response tells us the member scope. Restore
  // that inbox's saved cursor before advancing to the server's high water mark.
  if(expected===null&&retained.cursor!==null){expected=retained.cursor;page=await fetchAfter(expected);validate(page);}
  await inbox.receive({events:page.events.filter(filter),nextCursor:String(page.nextCursor)},expected);
  return page;
}
export function referenceAlertHistorical(event,now=Date.now()){
  const priceTime=Date.parse(event.priceAt);
  return Boolean(event.historical)||Number.isFinite(priceTime)&&now-priceTime>=30*60000;
}
export function referenceVoiceEligible(event,now=Date.now()){
  return event.deliveryVoice==='pending'&&!referenceAlertHistorical(event,now);
}
