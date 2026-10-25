export async function adminCodRequest(token,path="",values,signal){
  const headers={Authorization:`Bearer ${token}`};
  if(values){
    const prepared=await fetch("/api/auth/csrf",{credentials:"same-origin",cache:"no-store",signal});
    if(!prepared.ok)throw new Error("Could not prepare the secure request.");
    const csrf=await prepared.json();
    if(typeof csrf.headerName!=="string"||typeof csrf.token!=="string")throw new Error("Unexpected security response.");
    headers[csrf.headerName]=csrf.token;headers["Content-Type"]="application/json";
  }
  const response=await fetch(`/api/admin/cod/handovers${path}`,{method:values?"PATCH":"GET",credentials:"same-origin",cache:"no-store",headers,signal,body:values?JSON.stringify(values):undefined});
  if(!response.ok)throw new Error(({400:"Enter a reason when rejecting the handover.",401:"Please sign in again.",403:"Administrator access is required.",404:"Handover not found.",409:"This handover was already decided. Refresh its status."})[response.status]||"Could not confirm the request. Refresh before trying again.");
  return response.status===204?null:response.json();
}
