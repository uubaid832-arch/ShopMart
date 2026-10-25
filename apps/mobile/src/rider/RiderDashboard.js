import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { codRequest, money } from "./codApi";

export default function RiderDashboard({ session, revision, onOpenCash, onOpenDeliveries }) {
  const token=session.accessToken;
  const [reload,setReload]=useState(0);
  const [result,setResult]=useState(null);
  useEffect(()=>{
    const controller=new AbortController();
    codRequest(token,"/dashboard",undefined,controller.signal)
      .then(data=>{if(!controller.signal.aborted)setResult({token,reload,revision,data,error:""});})
      .catch(error=>{if(!controller.signal.aborted)setResult({token,reload,revision,error:error.message});});
    return ()=>controller.abort();
  },[token,reload,revision]);
  const current=result?.token===token&&result?.reload===reload&&result?.revision===revision;
  const data=current?result.data:null;
  return <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.headingRow}><View><Text style={styles.heading}>Your activity</Text><Text style={styles.muted}>All-time totals · your rider account</Text></View><Pressable accessibilityRole="button" disabled={!current} onPress={()=>setReload(v=>v+1)} style={styles.refresh}><Text style={styles.link}>Refresh</Text></Pressable></View>
    {!current?<ActivityIndicator color="#7c3aed" style={styles.loader}/>:result.error?<Text accessibilityRole="alert" style={styles.error}>{result.error}</Text>:<>
      <View style={styles.grid}>
        {[["Successful deliveries",data.successfulDeliveries,"#effaf4","#3a9c65"],["Failed attempts",data.failedAttempts,"#fff3f2","#ca7481"],["Assigned",data.assignedDeliveries,"#f2ecfd","#8c5acb"],["Cancelled",data.cancelledOrders,"#f5f2f7","#a38eaf"]].map(([title,value,backgroundColor,color])=><View key={title} style={[styles.stat,{backgroundColor}]}><Text style={[styles.value,{color}]}>{value}</Text><Text style={styles.statLabel}>{title}</Text></View>)}
      </View>
      <View style={styles.warehouse}><Text style={styles.warehouseText}>{data.warehousePending} warehouse return(s) awaiting resolution</Text></View>
      <Pressable accessibilityRole="button" onPress={onOpenDeliveries} style={styles.deliveries}><Text style={styles.link}>Open deliveries →</Text></Pressable>
      <View style={styles.cashCard}>
        <Text style={styles.eyebrow}>COD CASH ACCOUNT</Text>
        <Text style={styles.balance}>{money(data.outstandingBalance)}</Text><Text style={styles.balanceLabel}>Outstanding until admin confirmation</Text>
        <View style={styles.cashRows}>
          {[["Total collected",data.totalCollected],["Admin-confirmed handovers",data.confirmedHandovers],["Pending confirmation",data.pendingHandovers],["Available to report",data.unreportedBalance]].map(([label,value])=><View key={label} style={styles.cashRow}><Text style={styles.cashLabel}>{label}</Text><Text style={styles.cashValue}>{money(value)}</Text></View>)}
        </View>
        <Pressable accessibilityRole="button" onPress={onOpenCash} style={styles.primary}><Text style={styles.white}>Manage cash handovers</Text></Pressable>
        <Text style={styles.note}>COD collections are store cash, not your earnings. Pending reports remain outstanding until the administrator confirms receipt.</Text>
      </View>
    </>}
  </ScrollView>;
}
const styles=StyleSheet.create({
  content:{padding:20,paddingBottom:35},headingRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},heading:{fontSize:20,fontWeight:"800",color:"#45324f"},muted:{color:"#a896b1",fontSize:10,lineHeight:18,marginTop:5},refresh:{padding:13,backgroundColor:"#eee5fa",borderRadius:12},link:{color:"#8c52cb",fontWeight:"700",fontSize:12},loader:{marginTop:30},error:{color:"#be123c",lineHeight:22,marginTop:20},
  grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:12,marginTop:20},stat:{width:"48%",padding:18,borderRadius:20,minHeight:108},value:{fontSize:32,fontWeight:"800"},statLabel:{color:"#99849f",fontSize:11,fontWeight:"600",marginTop:8},warehouse:{padding:14,backgroundColor:"#fff6e7",borderRadius:13,marginTop:13},warehouseText:{color:"#af8d56",fontSize:11,lineHeight:18},deliveries:{paddingVertical:17,alignSelf:"flex-end"},
  cashCard:{padding:21,borderRadius:23,backgroundColor:"#f3ecfc",borderWidth:1,borderColor:"#e8dbf6"},eyebrow:{fontSize:9,fontWeight:"800",letterSpacing:1.7,color:"#aa8dc0"},balance:{fontSize:32,fontWeight:"800",color:"#7c3aed",marginTop:15,letterSpacing:-0.8},balanceLabel:{color:"#ab91ba",fontSize:11,lineHeight:18,marginTop:6},cashRows:{marginTop:20},cashRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,paddingVertical:11,borderTopWidth:1,borderTopColor:"#e8dcf3"},cashLabel:{flex:1,color:"#a18bad",fontSize:11},cashValue:{color:"#786089",fontSize:12,fontWeight:"700",maxWidth:"48%",textAlign:"right"},primary:{padding:16,backgroundColor:"#7c3aed",borderRadius:13,marginTop:17},white:{color:"#fff",fontWeight:"700",fontSize:12,textAlign:"center"},note:{color:"#b09cbe",fontSize:10,lineHeight:18,marginTop:14},
});
