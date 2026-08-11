import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, userName, categoryName, spent, limit, percentage } = body;

    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      // Simulação para quando a chave de API ainda não foi preenchida
      return NextResponse.json({
        success: true,
        simulated: true,
        message: `[Simulação Resend] E-mail de alerta para ${email}: O nicho '${categoryName}' atingiu ${percentage}% do limite (R$ ${spent} / R$ ${limit}).`,
      });
    }

    const resend = new Resend(resendApiKey);

    const data = await resend.emails.send({
      from: 'Gestão da Livinha <notificacoes@resend.dev>',
      to: [email],
      subject: `🚨 Alerta de Limite: Nicho '${categoryName}' atingiu ${percentage}%!`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; background-color: #f9f9f9; rounded: 12px;">
          <h2 style="color: #8257E5;">Olá, ${userName || 'Livinha'}! ❤️</h2>
          <p>Seu sistema <strong>Gestão da Livinha</strong> identificou um alerta de orçamento:</p>
          <div style="background-color: #fff; padding: 15px; border-radius: 8px; border-left: 4px solid #EF4444; margin: 15px 0;">
            <p style="margin: 0; font-size: 16px;"><strong>Nicho:</strong> ${categoryName}</p>
            <p style="margin: 5px 0 0 0; color: #666;"><strong>Gasto Atual:</strong> R$ ${spent} / <strong>Limite:</strong> R$ ${limit} (${percentage}%)</p>
          </div>
          <p style="font-size: 12px; color: #888;">Feito por Mozão com amor.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Erro ao enviar e-mail via Resend:', error);
    return NextResponse.json(
      { error: 'Falha ao processar envio de e-mail' },
      { status: 500 }
    );
  }
}
