import type { BaseValueObject, IFunctionInfo, IFunctionNames } from '@univerjs/engine-formula';
import type { Ctor } from '@univerjs/core';
import {
  ArrayValueObject,
  BaseFunction,
  FunctionType,
  NumberValueObject,
  StringValueObject,
  ErrorValueObject,
  ErrorType
} from '@univerjs/engine-formula';

/**
 * Custom function names
 */
export enum FUNCTION_NAMES_TASKSTATUS {
  TASKSTATUS = 'TASKSTATUS',
}

/**
 * Internationalization for the function
 */
export const functionTaskStatusEnUS = {
  formula: {
    functionList: {
      TASKSTATUS: {
        description: 'Reverses the digits of the input number. For example, TASKSTATUS(123) returns 321.',
        abstract: 'Reverses digits of a number',
        links: [
          {
            title: 'Instruction',
            url: 'https://docs.univer.ai/showcase/sheets/custom-formula',
          },
        ],
        functionParameter: {
          number: {
            name: 'number',
            detail: 'The number whose digits you want to reverse. Must be a positive integer.',
          },
        },
      },
    },
  },
};

/**
 * Function description for Univer
 */
export const FUNCTION_LIST_TASKSTATUS: IFunctionInfo[] = [
  {
    functionName: FUNCTION_NAMES_TASKSTATUS.TASKSTATUS,
    aliasFunctionName: 'formula.functionList.TASKSTATUS.aliasFunctionName',
    functionType: FunctionType.Univer,
    description: 'formula.functionList.TASKSTATUS.description',
    abstract: 'formula.functionList.TASKSTATUS.abstract',
    functionParameter: [
      {
        name: 'formula.functionList.TASKSTATUS.functionParameter.number.name',
        detail: 'formula.functionList.TASKSTATUS.functionParameter.number.detail',
        example: '123',
        require: 1,
        repeat: 0,
      },
    ],
  },
];

/**
 * TASKSTATUS function implementation
 */
export class TaskStatus extends BaseFunction {
  override calculate(numberParam: BaseValueObject) {
    // Handle errors from input
    if (numberParam.isError()) {
      return numberParam;
    }

    // Get the actual value
    const value = numberParam.getValue();
    
    // Convert to number if it's a string
    let numberValue: number;
    if (typeof value === 'string') {
      numberValue = parseInt(value, 10);
      if (isNaN(numberValue)) {
        return ErrorValueObject.create(ErrorType.VALUE);
      }
    } else if (typeof value === 'number') {
      numberValue = value;
    } else {
      return ErrorValueObject.create(ErrorType.VALUE);
    }

    // Check if it's a valid positive integer
    if (numberValue < 0 || !Number.isInteger(numberValue)) {
      return ErrorValueObject.create(ErrorType.VALUE);
    }

    // Convert to string, reverse, and convert back to number
    const reversedString = numberValue.toString().split('').reverse().join('');
    const reversedNumber = parseInt(reversedString, 10);

    return NumberValueObject.create(reversedNumber);
  }
}

/**
 * Export function for registration
 */
export const functionTaskStatus: Array<[Ctor<BaseFunction>, IFunctionNames]> = [
  [TaskStatus, FUNCTION_NAMES_TASKSTATUS.TASKSTATUS],
]; 