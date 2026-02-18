const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function createWeeklyPlan() {
  return DAYS.reduce((plan, day) => {
    plan[day] = { breakfast: null, lunch: null, dinner: null };
    return plan;
  }, {});
}

function setMeal(plan, day, mealType, meal) {
  if (!DAYS.includes(day)) {
    throw new Error(`Invalid day: ${day}`);
  }
  if (!["breakfast", "lunch", "dinner"].includes(mealType)) {
    throw new Error(`Invalid meal type: ${mealType}`);
  }
  plan[day][mealType] = meal;
  return plan;
}

function getMeal(plan, day, mealType) {
  return plan[day] && plan[day][mealType];
}

module.exports = { createWeeklyPlan, setMeal, getMeal, DAYS };
