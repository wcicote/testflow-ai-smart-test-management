import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { systemRequirement, bugDescription, action } = await req.json();
    console.log("Receiving request for action:", action || "generate-test");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is not set in Environment Variables");
      throw new Error("GEMINI_API_KEY is not configured in Supabase Secrets");
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "suggest-severity" && bugDescription) {
      systemPrompt = `Você é um especialista em QA e gestão de bugs. Analise a descrição do bug e sugira a severidade mais apropriada.
Responda APENAS com um JSON válido neste formato:
{
  "severity": "critical" | "high" | "medium" | "low",
  "reason": "Breve justificativa (máximo 50 palavras)"
}
Critérios: critical (sistema inoperante), high (funcionalidade principal quebrada), medium (secundária afetada), low (cosmético).`;
      userPrompt = `Analise este bug e sugira a severidade:\n\n${bugDescription}`;
    } else {
      if (!systemRequirement) {
        return new Response(
          JSON.stringify({ error: "System requirement is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      systemPrompt = `Você é um especialista em testes de software. Sua tarefa é gerar um caso de teste completo baseado em um requisito do sistema.
Responda SEMPRE em JSON válido com esta estrutura exata:
{
  "title": "Título claro e descritivo do caso de teste",
  "steps": "1. Passo um\\n2. Passo dois\\n3. Passo três...",
  "expectedResult": "Descrição do resultado esperado"
}`;
      userPrompt = `Gere um caso de teste completo para o seguinte requisito do sistema:\n\n${systemRequirement}`;
    }

    console.log("Calling Gemini API...");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: systemPrompt + "\n\n" + userPrompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error details:", errorText);
      return new Response(
        JSON.stringify({ error: "Erro na API do Gemini", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Gemini API successful response");

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      console.error("Gemini returned empty content:", JSON.stringify(data));
      throw new Error("A IA não retornou conteúdo. Verifique o prompt ou a quota da API.");
    }

    // Gemini 1.5 with responseMimeType: "application/json" returns a stringified JSON in the text field
    return new Response(content, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge Function Exception:", error.message);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
