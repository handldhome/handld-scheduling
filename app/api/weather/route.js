// Weather API route - fetches forecast for service area
// Uses OpenWeatherMap 5-day forecast API (free tier)

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

    // Use 5-day/3-hour forecast API (free tier)
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&units=imperial&appid=${apiKey}`
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Weather API error:', response.status, errorText)
      return Response.json({ error: `Weather API error: ${response.status}`, forecast: [] })
    }

    const data = await response.json()

    // Aggregate 3-hour forecasts into daily high/low
    const dailyData = {}

    data.list.forEach(item => {
      const date = item.dt_txt.split(' ')[0] // Get just the date part

      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          temps: [],
          icons: [],
          descriptions: []
        }
      }

      dailyData[date].temps.push(item.main.temp)
      dailyData[date].icons.push(item.weather[0]?.icon)
      dailyData[date].descriptions.push(item.weather[0]?.main)
    })

    // Convert to forecast array with high/low
    const forecast = Object.values(dailyData).map(day => {
      const high = Math.round(Math.max(...day.temps))
      const low = Math.round(Math.min(...day.temps))

      // Use the most common icon (midday preferred)
      const middayIndex = Math.floor(day.icons.length / 2)
      const icon = day.icons[middayIndex] || day.icons[0] || '01d'
      const description = day.descriptions[middayIndex] || day.descriptions[0] || 'Clear'

      return {
        date: day.date,
        high,
        low,
        icon,
        description
      }
    })

    console.log('Weather forecast fetched:', forecast.length, 'days')

    return Response.json({ forecast })
  } catch (error) {
    console.error('Error fetching weather:', error)
    return Response.json({ error: error.message, forecast: [] })
  }
}
