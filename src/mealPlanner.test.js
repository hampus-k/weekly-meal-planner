const { createWeeklyPlan, setMeal, getMeal, DAYS } = require("./mealPlanner");

describe("createWeeklyPlan", () => {
  test("creates a plan with all 7 days", () => {
    const plan = createWeeklyPlan();
    expect(Object.keys(plan)).toHaveLength(7);
    DAYS.forEach((day) => {
      expect(plan[day]).toBeDefined();
    });
  });

  test("initializes all meals as null", () => {
    const plan = createWeeklyPlan();
    DAYS.forEach((day) => {
      expect(plan[day].breakfast).toBeNull();
      expect(plan[day].lunch).toBeNull();
      expect(plan[day].dinner).toBeNull();
    });
  });
});

describe("setMeal", () => {
  test("sets a meal for a given day and meal type", () => {
    const plan = createWeeklyPlan();
    setMeal(plan, "Monday", "breakfast", "Oatmeal");
    expect(plan.Monday.breakfast).toBe("Oatmeal");
  });

  test("throws on invalid day", () => {
    const plan = createWeeklyPlan();
    expect(() => setMeal(plan, "Funday", "lunch", "Pizza")).toThrow("Invalid day");
  });

  test("throws on invalid meal type", () => {
    const plan = createWeeklyPlan();
    expect(() => setMeal(plan, "Monday", "brunch", "Eggs")).toThrow("Invalid meal type");
  });
});

describe("getMeal", () => {
  test("returns the correct meal", () => {
    const plan = createWeeklyPlan();
    setMeal(plan, "Friday", "dinner", "Pasta");
    expect(getMeal(plan, "Friday", "dinner")).toBe("Pasta");
  });
});
