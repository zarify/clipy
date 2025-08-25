// Configuration loading and management
export const configUrl = './config/sample.json'

export async function loadConfig() {
  try {
    const res = await fetch(configUrl)
    return await res.json()
  } catch (e) {
    return null
  }
}

export function $(id) { 
  return document.getElementById(id) 
}
