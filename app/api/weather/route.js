// Weather API route - fetches 7-day forecast for service area
// Uses OpenWeatherMap API (free tier)

export const revalidate = 1800 // Cache for 30 minutes

// Pasadena, CA coordinates (center of service area)
const LAT = 34.1478
const LON = -118.1445

export async function GET() {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY

    if (!apiKey) {
      console.warn('OPENWEATHER_API_KEY not configured')
      return Response.json({ error: 'Weather API not configured', forecast: [] })
    }

    // Use One Call API 3.0 for daily forecast
    // Free tier: 1,000 calls/day
    const response = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?lat=${LAT}&lon=${LON}&exclude=minutely,hourly,alerts&units=imperial&appid=${apiKey}`
    )

    if (!response.ok) {
      // Try the older 2.5 API as fallback
      const fallbackResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast/daily?lat=${LAT}&lon=${LON}&cnt=8&units=imperial&appid=${apiKey}`
      )

      if (!fallbackResponse.ok) {
        throw new Error(`Weather API error: ${response.status}`)
      }

      const fallbackData = await fallbackResponse.json()

      const forecast = fallbackData.list.map(day => ({
        date: new Date(day.dt * 1000).toISOString().split('T')[0],
        high: Math.round(day.temp.max),
        low: Math.round(day.temp.min),
        icon: day.weather[0]?.icon || '01d',
        description: day.weather[0]?.main || 'Clear',
        precipitation: day.pop ? Math.round(day.pop * 100) : 0
      }))

      return Response.json({ forecast })
    }

    const data = await response.json()

    // Map daily forecast to simpler format
    const forecast = data.daily.slice(0, 8).map(day => ({
      date: new Date(day.dt * 1000).toISOString().split('T')[0],
      high: Math.round(day.temp.max),
      low: Math.round(day.temp.min),
      icon: day.weather[0]?.icon || '01d',
      description: day.weather[0]?.main || 'Clear',
      precipitation: day.pop ? Math.round(day.pop * 100) : 0
    }))

    return Response.json({ forecast })
  } catch (error) {
    console.error('Error fetching weather:', error)
    return Response.json({ error: error.message, forecast: [] })
  }
}
