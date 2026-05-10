"use client";

import React, { useState } from 'react';
import { ingestEventFromText } from '@/services/event-ingestion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function IngestionTestPage() {
  const [logs, setLogs] = useState<{ id: string; msg: string; type: 'info' | 'success' | 'warning' | 'error' }[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setLogs(prev => [{ id: Math.random().toString(36).substr(2, 9), msg, type }, ...prev]);
  };

  const runTest = async (testName: string, text: string) => {
    setLoading(true);
    addLog(`Starting: ${testName}`, 'info');
    try {
      const result = await ingestEventFromText(text);
      if (result) {
        addLog(`Success! Created document with ID: ${result}`, 'success');
      } else {
        addLog(`Duplicate detected. Event was skipped as expected.`, 'warning');
      }
    } catch (error: any) {
      addLog(`Error: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const scenarios = [
    {
      name: "1. Initial Ingestion",
      text: "Turkey Scholarship 2026. Location: Turkey. Deadline: 2026-04-13 10:00. This is a fully funded opportunity.",
      desc: "Should create a new record in Firestore."
    },
    {
      name: "2. Exact Duplicate",
      text: "Turkey Scholarship 2026. Location: Turkey. Deadline: 2026-04-13 10:00. This is a fully funded opportunity.",
      desc: "Should return null (skipped)."
    },
    {
      name: "3. Fuzzy Duplicate",
      text: "  TURKEY SCHOLARSHIP 2026  . Location: turkey. Deadline: 2026-04-13 15:30. DIFFERENT DESCRIPTION TEXT.",
      desc: "Should return null (Matches title, location, and day despite caps/spaces)."
    },
    {
      name: "4. Different Event",
      text: "UK Masters Excellence 2026. Location: London, UK. Deadline: 2026-05-20. 100% tuition waiver for international students.",
      desc: "Should create a new record (Different title/location/date)."
    }
  ];

  return (
    <div className="container mx-auto py-20 px-4 max-w-4xl">
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-4 font-headline">Ingestion Logic Tester</h1>
        <p className="text-muted-foreground">Verify that the duplicate prevention logic in <code className="bg-muted px-1 rounded">src/services/event-ingestion.ts</code> is working correctly.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          {scenarios.map((s, i) => (
            <Card key={i} className="overflow-hidden border-primary/10 hover:border-primary/30 transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{s.name}</CardTitle>
                <CardDescription>{s.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-3 rounded text-[10px] font-mono mb-4 break-words">
                  {s.text}
                </div>
                <Button 
                  className="w-full font-bold" 
                  disabled={loading}
                  onClick={() => runTest(s.name, s.text)}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Run Test Scenario"}
                </Button>
              </CardContent>
            </Card>
          ))}
          
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setLogs([])}
          >
            Clear Log History
          </Button>
        </div>

        <Card className="h-[600px] flex flex-col border-primary/10 shadow-xl">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-xs uppercase tracking-widest opacity-50">Real-time Execution Logs</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-4 space-y-3 font-mono text-xs">
            {logs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic text-center p-8">
                <Loader2 className="h-8 w-8 mb-4 opacity-20" />
                No logs yet. Click a test scenario to begin verification.
              </div>
            )}
            {logs.map((log) => (
              <div key={log.id} className={`p-3 rounded-lg flex gap-3 animate-in slide-in-from-top-2 duration-300 ${
                log.type === 'success' ? 'bg-green-500/10 text-green-700 border border-green-500/20' :
                log.type === 'warning' ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20' :
                log.type === 'error' ? 'bg-red-500/10 text-red-700 border border-red-500/20' :
                'bg-slate-500/10 text-slate-700 border border-slate-500/20'
              }`}>
                {log.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />}
                {log.type === 'warning' && <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                {log.type === 'error' && <XCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                <span className="flex-1 leading-relaxed">{log.msg}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 p-6 rounded-2xl bg-primary/5 border border-primary/10 text-sm">
        <h3 className="font-bold mb-2">How it works:</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>The AI extracts structured data from the raw text.</li>
          <li>We normalize the <strong>title</strong>, <strong>location</strong>, and <strong>deadline date</strong>.</li>
          <li>A Firestore query checks for existing documents with matching normalized fields.</li>
          <li>If a match is found, the ingestion is aborted to prevent clutter.</li>
        </ul>
      </div>
    </div>
  );
}
