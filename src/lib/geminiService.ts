export const improvePkkDescription = async (text: string): Promise<string> => {
  if (!text || text.trim().length < 5) return text;

  try {
    const response = await fetch('/api/gemini/improve-pkk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    const data = await response.json();
    if (data.success && data.improvedText) {
      return data.improvedText;
    }
    return text;
  } catch (err) {
    console.error('Gemini Improvement Fetch Error:', err);
    return text;
  }
};

