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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Action: suggest severity for bug
    if (action === "suggest-severity" && bugDescription) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `Você é um especialista em QA e gestão de bugs. Analise a descrição do bug e sugira a severidade mais apropriada.

Responda APENAS com um JSON válido neste formato:
{
  "severity": "critical" | "high" | "medium" | "low",
  "reason": "Breve justificativa (máximo 50 palavras)"
}

Critérios de severidade:
- critical: Sistema inoperante, perda de dados, falha de segurança, impacto financeiro direto
- high: Funcionalidade principal quebrada, workaround difícil, afeta muitos usuários
- medium: Funcionalidade secundária afetada, existe workaround, impacto moderado
- low: Problema cosmético, melhoria, não afeta funcionalidade`,
            },
            {
              role: "user",
              content: `Analise este bug e sugira a severidade:\n\n${bugDescription}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(
            JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (response.status === 402) {
          return new Response(
            JSON.stringify({ error: "Créditos de IA esgotados. Adicione mais créditos." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error("Erro no gateway de IA");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("No content in AI response");
      }

      let parsed;
      try {
        const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleanContent);
      } catch (e) {
        console.error("Failed to parse severity response:", content);
        parsed = { severity: "medium", reason: "Não foi possível analisar automaticamente" };
      }

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: generate full test case
    if (!systemRequirement) {
      return new Response(
        JSON.stringify({ error: "System requirement is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em testes de software. Sua tarefa é gerar um caso de teste completo baseado em um requisito do sistema.

Responda SEMPRE em JSON válido com esta estrutura exata:
{
  "title": "Título claro e descritivo do caso de teste",
  "steps": "1. Passo um\\n2. Passo dois\\n3. Passo três...",
  "expectedResult": "Descrição do resultado esperado"
}

O título deve:
- Ser conciso e descritivo (máximo 80 caracteres)
- Começar com um verbo de ação (Validar, Verificar, Testar, Garantir)
- Indicar claramente o que está sendo testado

Os passos devem ser:
- Numerados sequencialmente
- Claros e objetivos
- Específicos e testáveis
- Em português brasileiro

O resultado esperado deve ser:
- Uma descrição clara do comportamento esperado
- Mensurável e verificável`,
          },
          {
            role: "user",
            content: `Gere um caso de teste completo para o seguinte requisito do sistema:\n\n${systemRequirement}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione mais créditos." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro no gateway de IA");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse the JSON response from AI
    let parsed;
    try {
      // Clean up potential markdown code blocks
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleanContent);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      // Fallback: return raw content as steps
      parsed = {
        title: "Caso de Teste",
        steps: content,
        expectedResult: "Verificar se o requisito foi atendido conforme especificado.",
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Generate test steps error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
