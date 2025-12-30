import { OperatorType } from "./conditionSchema";
import { variableResolver } from "./variableResolver";

export interface ConditionConfig {
  evaluationType: "simple" | "compound";

  // Simple condition (single comparison)
  simple?: {
    leftOperand: {
      type: "variable" | "literal";
      value: string;
    };
    operator: OperatorType;
    rightOperand: {
      type: "variable" | "literal";
      value: string;
    };
  };

  // Compound condition (multiple conditions with logic)
  compound?: {
    logic: "AND" | "OR";
    conditions: ConditionConfig[];
  };
}

export class ConditionEvaluator {
  /**
   * Evaluate a condition against workflow context
   */
  evaluate(config: ConditionConfig, context: any): boolean {
    try {
      if (config.evaluationType === "simple" && config.simple) {
        return this.evaluateSimple(config.simple, context);
      }

      if (config.evaluationType === "compound" && config.compound) {
        return this.evaluateCompound(config.compound, context);
      }

      console.warn("[ConditionEvaluator] Invalid condition config:", config);
      return false;
    } catch (error) {
      console.error("[ConditionEvaluator] Error evaluating condition:", error);
      return false;
    }
  }

  /**
   * Evaluate a simple condition
   */
  private evaluateSimple(
    simple: NonNullable<ConditionConfig["simple"]>,
    context: any
  ): boolean {
    const left = this.resolveValue(simple.leftOperand, context);
    const right = this.resolveValue(simple.rightOperand, context);

    return this.compareValues(left, simple.operator, right);
  }

  /**
   * Evaluate a compound condition
   */
  private evaluateCompound(
    compound: NonNullable<ConditionConfig["compound"]>,
    context: any
  ): boolean {
    const results = compound.conditions.map((condition) =>
      this.evaluate(condition, context)
    );

    if (compound.logic === "AND") {
      return results.every((r) => r);
    } else {
      return results.some((r) => r);
    }
  }

  /**
   * Resolve a value (variable or literal)
   */
  private resolveValue(
    operand: { type: "variable" | "literal"; value: string },
    context: any
  ): any {
    if (operand.type === "literal") {
      // Try to parse as number or boolean
      if (operand.value === "true") return true;
      if (operand.value === "false") return false;
      if (!isNaN(Number(operand.value))) return Number(operand.value);
      return operand.value;
    }

    // Variable - use variable resolver
    try {
      return variableResolver.get(operand.value, context);
    } catch (error) {
      console.warn(
        `[ConditionEvaluator] Failed to resolve variable: ${operand.value}`,
        error
      );
      return undefined;
    }
  }

  /**
   * Compare two values using an operator
   */
  private compareValues(
    left: any,
    operator: OperatorType,
    right: any
  ): boolean {
    // Handle null/undefined
    if (operator === OperatorType.EXISTS) {
      return left !== null && left !== undefined;
    }
    if (operator === OperatorType.NOT_EXISTS) {
      return left === null || left === undefined;
    }
    if (operator === OperatorType.IS_EMPTY) {
      return (
        left === null ||
        left === undefined ||
        left === "" ||
        (Array.isArray(left) && left.length === 0)
      );
    }
    if (operator === OperatorType.IS_NOT_EMPTY) {
      return (
        left !== null &&
        left !== undefined &&
        left !== "" &&
        !(Array.isArray(left) && left.length === 0)
      );
    }

    // Equality
    if (operator === OperatorType.EQUALS) {
      return left == right; // Loose equality
    }
    if (operator === OperatorType.NOT_EQUALS) {
      return left != right;
    }

    // Numeric comparisons
    if (operator === OperatorType.GREATER_THAN) {
      return Number(left) > Number(right);
    }
    if (operator === OperatorType.LESS_THAN) {
      return Number(left) < Number(right);
    }
    if (operator === OperatorType.GREATER_EQUAL) {
      return Number(left) >= Number(right);
    }
    if (operator === OperatorType.LESS_EQUAL) {
      return Number(left) <= Number(right);
    }

    // String operations
    if (operator === OperatorType.CONTAINS) {
      return String(left).toLowerCase().includes(String(right).toLowerCase());
    }
    if (operator === OperatorType.NOT_CONTAINS) {
      return !String(left).toLowerCase().includes(String(right).toLowerCase());
    }
    if (operator === OperatorType.STARTS_WITH) {
      return String(left).toLowerCase().startsWith(String(right).toLowerCase());
    }
    if (operator === OperatorType.ENDS_WITH) {
      return String(left).toLowerCase().endsWith(String(right).toLowerCase());
    }
    if (operator === OperatorType.MATCHES_REGEX) {
      try {
        const regex = new RegExp(String(right));
        return regex.test(String(left));
      } catch (error) {
        console.error("[ConditionEvaluator] Invalid regex:", right);
        return false;
      }
    }

    // Array operations
    if (operator === OperatorType.INCLUDES) {
      if (Array.isArray(left)) {
        return left.includes(right);
      }
      return false;
    }
    if (operator === OperatorType.NOT_INCLUDES) {
      if (Array.isArray(left)) {
        return !left.includes(right);
      }
      return true;
    }
    if (operator === OperatorType.IN) {
      if (Array.isArray(right)) {
        return right.includes(left);
      }
      return false;
    }
    if (operator === OperatorType.NOT_IN) {
      if (Array.isArray(right)) {
        return !right.includes(left);
      }
      return true;
    }
    if (operator === OperatorType.COUNT) {
      if (Array.isArray(left)) {
        return left.length == right;
      }
      return false;
    }

    // Time operations
    if (operator === OperatorType.IS_BEFORE) {
      return new Date(left) < new Date(right);
    }
    if (operator === OperatorType.IS_AFTER) {
      return new Date(left) > new Date(right);
    }
    if (operator === OperatorType.IS_WITHIN_LAST) {
      const now = new Date();
      const leftDate = new Date(left);
      const duration = this.parseDuration(String(right));
      const threshold = new Date(now.getTime() - duration);
      return leftDate >= threshold;
    }
    if (operator === OperatorType.IS_OLDER_THAN) {
      const now = new Date();
      const leftDate = new Date(left);
      const duration = this.parseDuration(String(right));
      const threshold = new Date(now.getTime() - duration);
      return leftDate < threshold;
    }
    if (operator === OperatorType.IS_BETWEEN) {
      // Expects right to be in format "value1,value2" or an array
      let range: any[];
      if (Array.isArray(right)) {
        range = right;
      } else if (typeof right === "string" && right.includes(",")) {
        range = right.split(",").map((v) => v.trim());
      } else {
        return false;
      }

      if (range.length !== 2) return false;

      // For numbers
      if (!isNaN(Number(left))) {
        const leftNum = Number(left);
        const min = Number(range[0]);
        const max = Number(range[1]);
        return leftNum >= min && leftNum <= max;
      }

      // For dates
      try {
        const leftDate = new Date(left);
        const minDate = new Date(range[0]);
        const maxDate = new Date(range[1]);
        return leftDate >= minDate && leftDate <= maxDate;
      } catch {
        return false;
      }
    }

    console.warn(`[ConditionEvaluator] Unknown operator: ${operator}`);
    return false;
  }

  /**
   * Parse duration string like "7 days", "24 hours", "30 minutes"
   */
  private parseDuration(duration: string): number {
    const match = duration.match(
      /^(\d+)\s*(minute|hour|day|week|month|year)s?$/i
    );
    if (!match) {
      console.warn(`[ConditionEvaluator] Invalid duration format: ${duration}`);
      return 0;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    const multipliers: Record<string, number> = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000, // Approximate
      year: 365 * 24 * 60 * 60 * 1000, // Approximate
    };

    return value * (multipliers[unit] || 0);
  }
}

// Singleton instance
export const conditionEvaluator = new ConditionEvaluator();
