package dev.awc.playground

import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject

/** UI-thread-owned results; awaiting a native lifecycle never occupies HTTP input. */
internal class LivePreviewMethodCalls(
    private val invoke:suspend (String,List<String>)->Unit,
    private val validate:(String,JSONArray)->List<String>,
) {
    constructor(invoke:suspend (String)->Unit):this({method,_->invoke(method)},{method,args->
        require(method in setOf("show","close","whenClosed") && args.length()==0) { "Menu methods accept no arguments." };emptyList()
    })
    private data class Call(val method:String,val arguments:List<String>,var status:String="pending",var error:JSONObject?=null)
    private val calls=linkedMapOf<String,Call>()
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main.immediate)
    private fun id(value:Any?):String {
        require(value is String && value.matches(Regex("[A-Za-z0-9_-]{1,80}"))) { "Invalid method call ID." }
        return value
    }
    private fun rejected(callID:String,code:String,message:String)=JSONObject().put("callId",callID).put("status","rejected")
        .put("error",JSONObject().put("code",code).put("message",message))
    fun accept(request:JSONObject):JSONObject {
        val callID=id(request.opt("callId"))
        require(request.optString("target")=="component") { "Unsupported native method target." }
        val method=request.optString("method")
        val arguments=validate(method,request.getJSONArray("arguments"))
        val old=calls[callID]
        if(old!=null && (old.method!=method || old.arguments!=arguments)) return rejected(callID,"METHOD_CALL_ID_MISMATCH","This call ID belongs to a different method or arguments.")
        if(old==null) {
            if(calls.size>=32) return rejected(callID,"METHOD_CALLS_BUSY","Acknowledge completed native calls before starting more.")
            val call=Call(method,arguments);calls[callID]=call
            scope.launch {
                try { invoke(method,arguments);call.status="fulfilled" }
                catch(error:CancellationException) { throw error }
                catch(error:Exception) {
                    call.status="rejected"
                    call.error=JSONObject().put("code","NATIVE_METHOD_FAILED").put("message",(error.message ?: "Native method failed.").take(512))
                }
            }
        }
        return JSONObject().put("callId",callID).put("status","accepted")
    }
    private fun ids(request:JSONObject,name:String):List<String> {
        val values=request.getJSONArray(name)
        require(values.length()<=32) { "Use at most 32 method call IDs." }
        return (0 until values.length()).map { id(values.get(it)) }.also { require(it.toSet().size==it.size) { "Method call IDs must be distinct." } }
    }
    fun results(request:JSONObject):JSONArray {
        val queried=ids(request,"callIds");val acknowledged=ids(request,"acknowledged")
        require(queried.none { it in acknowledged }) { "A requested call cannot also be acknowledged." }
        acknowledged.forEach { id->if(calls[id]?.status!="pending") calls.remove(id) }
        return JSONArray().also { result->
            queried.forEach { id->
                val call=calls[id]
                result.put(if(call==null) rejected(id,"UNKNOWN_METHOD_CALL","No native call has this ID.")
                    else JSONObject().put("callId",id).put("status",call.status).also { call.error?.let { error->it.put("error",error) } })
            }
        }
    }
    fun dispose() { scope.cancel();calls.clear() }
}
