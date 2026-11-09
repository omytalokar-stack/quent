const NTFY_TOPIC = process.env.NTFY_TOPIC || 'qc_node_99x_trd_8f4a2c19e7';

export async function sendTradeAlert(
  title,
  message,
  priority = 'default',
  tags = ['chart_with_upwards_trend']
) {
  try {
    const response = await fetch(`https://ntfy.sh/${encodeURIComponent(NTFY_TOPIC)}`, {
      method: 'POST',
      body: message,
      headers: {
        Title: title,
        Priority: priority,
        Tags: tags.join(','),
      },
    });
    if (!response.ok) {
      console.error(`[Notifier] ntfy returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.error(
      '[Notifier] Failed to send ntfy alert:',
      error instanceof Error ? error.message : String(error)
    );
  }
}
