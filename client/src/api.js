const BASE = (import.meta.env.VITE_API_URL || '') + '/api'

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

async function patch(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

async function del(url) {
  const res = await fetch(url, { method: 'DELETE' })
  return res.json()
}

export const getFoods = (q = '') =>
  fetch(q ? `${BASE}/foods?q=${encodeURIComponent(q)}` : `${BASE}/foods`).then(r => r.json())

export const addFood = (food) => post(`${BASE}/foods`, food)
export const deleteFood = (id) => del(`${BASE}/foods/${id}`)

export const getRecommendation = (totalCarbs, preSugar) =>
  post(`${BASE}/recommend`, { total_carbs: totalCarbs, pre_sugar: preSugar })

export const getNovorapidHistory = () =>
  fetch(`${BASE}/novorapid`).then(r => r.json())

export const recordNovorapid = (data) => post(`${BASE}/novorapid`, data)

export const updatePostSugar = (id, postSugar) =>
  patch(`${BASE}/novorapid/${id}/post_sugar`, { post_1hr_sugar: postSugar })

export const deleteNovorapid = (id) => del(`${BASE}/novorapid/${id}`)

export const getTregludecHistory = () =>
  fetch(`${BASE}/tregludec`).then(r => r.json())

export const recordTregludec = (data) => post(`${BASE}/tregludec`, data)
export const deleteTregludec = (id) => del(`${BASE}/tregludec/${id}`)

export const getStatistics = () =>
  fetch(`${BASE}/statistics`).then(r => r.json())

export const getDashboard = () =>
  fetch(`${BASE}/dashboard`).then(r => r.json())

export const recordSensorChange = () => post(`${BASE}/sensor`, {})

export const getFreeMeals = () =>
  fetch(`${BASE}/free-meals`).then(r => r.json())

export const recordFreeMeal = (data) => post(`${BASE}/free-meals`, data)

export const updateFreeMealPostSugar = (id, postSugar) =>
  patch(`${BASE}/free-meals/${id}/post_sugar`, { post_1hr_sugar: postSugar })

export const deleteFreeMeal = (id) => del(`${BASE}/free-meals/${id}`)
