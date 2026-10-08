#property strict
#property version "2.12"
#property description "Nugaom read-only symbol/quote/candle bridge. No account credentials or order operations."
input string Endpoint = "http://localhost:3100/api/forex/mt5";
input bool LocalFiles = false; // Same-computer file transport; no WebRequest needed
input string LocalChannel = ""; // 32 hex characters shown by the local web UI
input string BridgeToken = ""; // One-time pairing key, never an MT5 password
input string ExpectedServer = "VantageMarkets-Demo";
input int ServerUtcOffsetMinutes = 10000; // Must confirm broker clock offset; 10000 disables prices/bars
input int PollSeconds = 5;

long sequence_id = 0, sync_id = 0;
int next_part = 0, universe_total = 0;
bool needs_sync = true;
datetime synced_at = 0;
string requested_symbol = "", requested_frame = "1h";
long pending_file_sequence = 0;

string ServerLabel() {
   string value=ExpectedServer;
   StringTrimLeft(value); StringTrimRight(value);
   return value;
}
bool ServerMatches() {
   string actual=AccountInfoString(ACCOUNT_SERVER), approved=ServerLabel();
   StringTrimLeft(actual); StringTrimRight(actual);
   StringToLower(actual); StringToLower(approved);
   return actual==approved; // No suffix, wildcard or substring matches; Demo and Live remain distinct.
}
string J(string value) {
   string out="";
   for(int i=0;i<StringLen(value);i++) {
      ushort ch=StringGetCharacter(value,i);
      if(ch==34) out+="\\\"";
      else if(ch==92) out+="\\\\";
      else if(ch<32) out+=StringFormat("\\u%04x",(int)ch);
      else out+=StringSubstr(value,i,1);
   }
   return "\""+out+"\"";
}
string N(double value) { return MathIsValidNumber(value) ? DoubleToString(value,12) : "null"; }
string SD(string symbol, ENUM_SYMBOL_INFO_DOUBLE prop) {
   double value; return SymbolInfoDouble(symbol,prop,value) && (prop!=SYMBOL_POINT || value>0) ? N(value) : "null";
}
string SI(string symbol, ENUM_SYMBOL_INFO_INTEGER prop) {
   long value; return SymbolInfoInteger(symbol,prop,value) ? IntegerToString(value) : "null";
}
string SS(string symbol, ENUM_SYMBOL_INFO_STRING prop) {
   string value; return SymbolInfoString(symbol,prop,value) && value!="" ? J(value) : "null";
}
string UTC() {
   string value = TimeToString(TimeGMT(),TIME_DATE|TIME_SECONDS);
   StringReplace(value,".","-"); StringReplace(value," ","T"); return value+"Z";
}
string Category(string symbol) {
   string path = SymbolInfoString(symbol,SYMBOL_PATH); StringToLower(path);
   string base = SymbolInfoString(symbol,SYMBOL_CURRENCY_BASE);
   if(StringFind(path,"bond")>=0) return J("bonds");
   if(StringFind(path,"etf")>=0) return J("etfs");
   if(StringFind(path,"crypto")>=0) return J("crypto_cfds");
   if(StringFind(path,"share")>=0 || StringFind(path,"stock")>=0 || StringFind(path,"equities")>=0) return J("share_cfds");
   if(base=="XAU" || base=="XAG" || StringFind(path,"metal")>=0) return J("metals");
   if(StringFind(path,"indice")>=0 || StringFind(path,"index")>=0) return J("indices");
   if(StringFind(path,"energy")>=0 || StringFind(path,"oil")>=0) return J("energy");
   if(StringFind(path,"commodit")>=0) return J("commodities");
   if(StringFind(path,"forex")>=0 || StringFind(path,"fx\\")>=0) return J("fx");
   return "null"; // Broker folder classification is best effort; never guess unfamiliar names
}
string SessionTime(datetime value) { return (long)value==86400 ? "24:00:00" : TimeToString(value,TIME_SECONDS); }
string Sessions(string symbol) {
   string rows="";
   for(int day=0;day<7;day++) {
      for(uint index=0;index<10;index++) {
         datetime from,to;
         if(!SymbolInfoSessionTrade(symbol,(ENUM_DAY_OF_WEEK)day,index,from,to)) break;
         if(rows!="") rows+=",";
         rows+="{\"day\":"+IntegerToString(day)+",\"open\":"+J(SessionTime(from))+",\"close\":"+J(SessionTime(to))+"}";
      }
   }
   return rows=="" ? "null" : "{\"timezone\":\"broker-server\",\"intervals\":["+rows+"]}";
}
string Instrument(string symbol) {
   string base=SymbolInfoString(symbol,SYMBOL_CURRENCY_BASE), profit=SymbolInfoString(symbol,SYMBOL_CURRENCY_PROFIT);
   // Preserve suffixes. Canonical mapping is provided only when terminal name is an exact currency pair.
   string canonical=(StringLen(base)==3 && StringLen(profit)==3 && symbol==base+profit) ? J(symbol) : "null";
   string description=SymbolInfoString(symbol,SYMBOL_DESCRIPTION); if(description=="") description=symbol;
   return "{\"broker_symbol\":"+J(symbol)+",\"canonical_symbol\":"+canonical+",\"category\":"+Category(symbol)+
      ",\"description\":"+J(description)+",\"digits\":"+SI(symbol,SYMBOL_DIGITS)+",\"point\":"+SD(symbol,SYMBOL_POINT)+
      ",\"contract_size\":"+SD(symbol,SYMBOL_TRADE_CONTRACT_SIZE)+",\"volume_min\":"+SD(symbol,SYMBOL_VOLUME_MIN)+
      ",\"volume_max\":"+SD(symbol,SYMBOL_VOLUME_MAX)+",\"volume_step\":"+SD(symbol,SYMBOL_VOLUME_STEP)+
      ",\"currency_base\":"+SS(symbol,SYMBOL_CURRENCY_BASE)+",\"currency_profit\":"+SS(symbol,SYMBOL_CURRENCY_PROFIT)+
      ",\"currency_margin\":"+SS(symbol,SYMBOL_CURRENCY_MARGIN)+",\"trade_mode\":"+SI(symbol,SYMBOL_TRADE_MODE)+
      ",\"session\":"+Sessions(symbol)+"}";
}
string ReadField(string json,string key) {
   string prefix="\""+key+"\":\"";
   int start=StringFind(json,prefix); if(start<0) return "";
   start+=StringLen(prefix); int end=StringFind(json,"\"",start);
   return end<0 ? "" : StringSubstr(json,start,end-start);
}
string Unhex(string value) {
   if(StringLen(value)%2!=0) return "";
   char bytes[]; ArrayResize(bytes,StringLen(value)/2);
   string alphabet="0123456789abcdef";
   for(int i=0;i<ArraySize(bytes);i++) {
      int a=StringFind(alphabet,StringSubstr(value,i*2,1)), b=StringFind(alphabet,StringSubstr(value,i*2+1,1));
      if(a<0 || b<0) return ""; bytes[i]=(char)(a*16+b);
   }
   return CharArrayToString(bytes,0,ArraySize(bytes),CP_UTF8);
}
bool SendLocal(string body) {
   string prefix="NugaomBridge\\"+LocalChannel;
   string temporary=prefix+".packet.tmp", target=prefix+".packet.json";
   int handle=FileOpen(temporary,FILE_WRITE|FILE_TXT|FILE_ANSI,0,CP_UTF8);
   if(handle==INVALID_HANDLE) { Print("Nugaom: cannot write local packet / ",GetLastError()); return false; }
   uint written=FileWriteString(handle,body); FileFlush(handle); FileClose(handle);
   if(written==0 || !FileMove(temporary,0,target,FILE_REWRITE)) return false;
   pending_file_sequence=sequence_id;
   return false; // Advance the universe only after the web server acknowledges this packet.
}
bool ReadLocalReply() {
   int handle=FileOpen("NugaomBridge\\"+LocalChannel+".reply.json",FILE_READ|FILE_TXT|FILE_ANSI|FILE_SHARE_READ,0,CP_UTF8);
   if(handle==INVALID_HANDLE) return false;
   string response=FileReadString(handle); FileClose(handle);
   if(ReadField(response,"sequence")!=IntegerToString(pending_file_sequence)) return false;
   pending_file_sequence=0;
   string status=ReadField(response,"status");
   if(status!="200") {
      Print("Nugaom: local file packet rejected / ",status);
      if(status=="401" || status=="403" || status=="409") EventKillTimer();
      return false;
   }
   string wanted=Unhex(ReadField(response,"requested_symbol_hex")), frame=ReadField(response,"requested_frame");
   if(wanted!="") requested_symbol=wanted;
   if(frame=="15m" || frame=="1h" || frame=="4h" || frame=="1d") requested_frame=frame;
   return true;
}
bool Send(string fields) {
   if(LocalFiles && pending_file_sequence>0) return ReadLocalReply();
   // Publish the approved label after checking the terminal name; backend allowlists remain exact.
   string body="{\"schema_version\":1,\"broker_id\":\"vantage\",\"server\":"+J(ServerLabel())+
      ",\"company\":"+J(AccountInfoString(ACCOUNT_COMPANY))+",\"sent_at\":"+J(UTC())+
      ",\"sequence\":"+IntegerToString(++sequence_id)+","+fields+"}";
   if(LocalFiles) return SendLocal(body);
   char data[],result[]; string response_headers;
   int size=StringToCharArray(body,data,0,WHOLE_ARRAY,CP_UTF8); ArrayResize(data,size-1);
   ResetLastError();
   int status=WebRequest("POST",Endpoint,"Content-Type: application/json\r\nAuthorization: Bearer "+BridgeToken+"\r\n",5000,data,result,response_headers);
   if(status!=200) {
      // Never print the token or payload. A changed broker/expired key stops the adapter.
      Print("Nugaom bridge: HTTP ",status," / network code ",GetLastError());
      if(status==401 || status==403 || status==409) EventKillTimer();
      return false;
   }
   string response=CharArrayToString(result,0,WHOLE_ARRAY,CP_UTF8);
   string wanted=Unhex(ReadField(response,"requested_symbol_hex"));
   string frame=ReadField(response,"requested_frame");
   if(wanted!="") requested_symbol=wanted;
   if(frame=="15m" || frame=="1h" || frame=="4h" || frame=="1d") requested_frame=frame;
   return true;
}
ENUM_TIMEFRAMES Frame() {
   if(requested_frame=="15m") return PERIOD_M15;
   if(requested_frame=="4h") return PERIOD_H4;
   if(requested_frame=="1d") return PERIOD_D1;
   return PERIOD_H1;
}
string Quote(string symbol) {
   MqlTick tick;
   if(!SymbolInfoTick(symbol,tick) || tick.bid<=0 || tick.ask<tick.bid) return "";
   long time=(long)tick.time-ServerUtcOffsetMinutes*60;
   return "{\"broker_symbol\":"+J(symbol)+",\"bid\":"+N(tick.bid)+",\"ask\":"+N(tick.ask)+",\"time\":"+IntegerToString(time)+"}";
}
string Chart() {
   if(requested_symbol=="" || !SymbolSelect(requested_symbol,true)) return "null";
   MqlRates rates[]; ArraySetAsSeries(rates,false);
   // Closed bars only. Keep within the current broker offset period (max 24 hours).
   int copied=CopyRates(requested_symbol,Frame(),1,100,rates);
   string rows="";
   for(int i=0;i<copied;i++) {
      long time=(long)rates[i].time-ServerUtcOffsetMinutes*60;
      if(time<(long)TimeGMT()-86400) continue;
      if(rows!="") rows+=",";
      rows+="{\"time\":"+IntegerToString(time)+",\"open\":"+N(rates[i].open)+",\"high\":"+N(rates[i].high)+
         ",\"low\":"+N(rates[i].low)+",\"close\":"+N(rates[i].close)+",\"volume\":"+IntegerToString(rates[i].tick_volume)+"}";
   }
   if(rows=="") return "null";
   return "{\"broker_symbol\":"+J(requested_symbol)+",\"timeframe\":"+J(requested_frame)+
      ",\"utc_offset_minutes\":"+IntegerToString(ServerUtcOffsetMinutes)+",\"bars\":["+rows+"]}";
}
int InitError(string reason) {
   Print("Nugaom setup: ",reason);
   return INIT_PARAMETERS_INCORRECT;
}
int OnInit() {
   string company=AccountInfoString(ACCOUNT_COMPANY); StringToLower(company);
   if(!ServerMatches()) {
      Print("Nugaom setup: terminal server is ",AccountInfoString(ACCOUNT_SERVER));
      return InitError("SERVER_MISMATCH: select the approved Vantage server");
   }
   if(StringFind(company,"vantage")<0) return InitError("COMPANY_MISMATCH: terminal must be connected to Vantage");
   if(LocalFiles) {
      if(StringLen(LocalChannel)!=32) {
         Print("Nugaom setup: LocalChannel length is ",StringLen(LocalChannel),"; expected 32");
         return InitError("CHANNEL_LENGTH: load the local preset or copy the full channel");
      }
      for(int i=0;i<32;i++) if(StringFind("0123456789abcdef",StringSubstr(LocalChannel,i,1))<0) return InitError("CHANNEL_FORMAT: local channel must contain only lowercase hex characters");
   } else if(StringLen(BridgeToken)!=43) return InitError("TOKEN_LENGTH: HTTP mode requires a pairing key; local file mode does not");
   bool secure=StringFind(Endpoint,"https://")==0;
   bool local=StringFind(Endpoint,"http://localhost:")==0 || StringFind(Endpoint,"http://127.0.0.1:")==0;
   if(!LocalFiles && !secure && !local) return InitError("ENDPOINT_SCHEME: use HTTPS or local loopback");
   if(PollSeconds<5 || PollSeconds>60) return InitError("POLL_SECONDS: use 5 to 60 seconds");
   if(LocalFiles && MQLInfoInteger(MQL_TESTER)) return InitError("STRATEGY_TESTER: attach the local EA to a terminal chart");
   sequence_id=(long)TimeGMT()*1000000+(long)(GetMicrosecondCount()%1000000);
   if(MathAbs(ServerUtcOffsetMinutes)>840) Print("Nugaom: universe only; confirm broker UTC offset to enable prices/candles.");
   if(!EventSetTimer(PollSeconds)) return InitError("TIMER_FAILED: cannot start the export timer");
   Print("Nugaom setup: ready; read-only market export started");
   return INIT_SUCCEEDED;
}
void OnDeinit(const int reason) { EventKillTimer(); }
void OnTimer() {
   if(!TerminalInfoInteger(TERMINAL_CONNECTED)) return;
   string company=AccountInfoString(ACCOUNT_COMPANY); StringToLower(company);
   if(!ServerMatches() || StringFind(company,"vantage")<0) { EventKillTimer(); return; }
   int total=SymbolsTotal(false);
   if(total<=0) return;
   if(total!=universe_total || TimeGMT()-synced_at>900) needs_sync=true;
   if(needs_sync) {
      if(next_part==0) { universe_total=total; sync_id=sequence_id+1; }
      if(total!=universe_total) { next_part=0; pending_file_sequence=0; return; }
      int parts=(total+99)/100; if(parts>200) { Print("Nugaom: universe too large"); EventKillTimer(); return; }
      string rows="";
      for(int index=next_part*100;index<MathMin(total,(next_part+1)*100);index++) {
         string symbol=SymbolName(index,false); if(symbol=="") return;
         if(rows!="") rows+=","; rows+=Instrument(symbol);
      }
      if(Send("\"kind\":\"universe\",\"sync_id\":"+IntegerToString(sync_id)+",\"part\":"+IntegerToString(next_part)+
         ",\"parts\":"+IntegerToString(parts)+",\"instruments\":["+rows+"]")) {
         next_part++;
         if(next_part==parts) { next_part=0; needs_sync=false; synced_at=TimeGMT(); }
      }
      return;
   }
   string quotes="", chart="null";
   if(MathAbs(ServerUtcOffsetMinutes)<=840) {
      if(requested_symbol!="") SymbolSelect(requested_symbol,true);
      // Quote the requested chart symbol first, then at most 99 other Market Watch symbols.
      if(requested_symbol!="") quotes=Quote(requested_symbol);
      int count=MathMin(SymbolsTotal(true),99);
      for(int i=0;i<count;i++) {
         string symbol=SymbolName(i,true); if(symbol==requested_symbol) continue;
         string row=Quote(symbol);
         if(row!="") { if(quotes!="") quotes+=","; quotes+=row; }
      }
      chart=Chart();
   }
   Send("\"kind\":\"feed\",\"quotes\":["+quotes+"],\"chart\":"+chart);
}
