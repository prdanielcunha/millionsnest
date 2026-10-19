import {auth} from './firebase.js'
const base=''
export type DirectoryPerson={id:string;name:string;hasAccount:boolean;unitIds:string[];revision:number;mergedInto?:string}
export type DirectorySelection={personId?:string;distinctReason?:string}
export class PeopleDirectoryError extends Error{code:string;constructor(code:string){super(code);this.code=code}}
export async function directoryRequest(org:string,body?:Record<string,unknown>,query=''){
  const user=auth?.currentUser
  if(!user)throw new PeopleDirectoryError('UNAUTHENTICATED')
  const response=await fetch(base+'/api/v1/organizations/'+encodeURIComponent(org)+'/people-directory'+query,{
    method:body?'POST':'GET',headers:{Authorization:'Bearer '+await user.getIdToken(),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000),
  })
  const result=await response.json()
  if(!response.ok||result.success!==true)throw new PeopleDirectoryError(result.reasonCode||'DIRECTORY_UNAVAILABLE')
  return result
}
export async function refreshPeopleDirectory(org:string){
  for(const kind of ['account','journey']){
    let cursor:string|undefined
    for(let page=0;page<100;page++){
      const result=await directoryRequest(org,{action:'sync',kind,...(cursor?{cursor}:{})})
      if(!result.nextCursor)break
      cursor=result.nextCursor
      if(page===99)throw new PeopleDirectoryError('DIRECTORY_SYNC_PAGE_LIMIT')
    }
  }
}
export async function searchPeopleDirectory(org:string,q:string):Promise<DirectoryPerson[]>{
  const people:DirectoryPerson[]=[]
  let cursor=''
  for(let page=0;page<100;page++){
    const result=await directoryRequest(org,undefined,'?q='+encodeURIComponent(q)+(cursor?'&cursor='+encodeURIComponent(cursor):''))
    people.push(...result.people)
    if(!result.nextCursor)return people
    cursor=result.nextCursor
  }
  throw new PeopleDirectoryError('DIRECTORY_SEARCH_LIMIT')
}
export function registerCentralPeople(org:string,unitId:string,requestId:string,rows:Array<Record<string,unknown>>,kind:'member'|'visitor'='member'){
  return directoryRequest(org,{action:'register',kind,unitId,requestId,rows})
}
