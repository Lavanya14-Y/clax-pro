from __future__ import annotations

import ast
import json
import math
import os
import re
import time
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ============================================================
# CALCX PRO 8.0
# Production-style Scientific Calculator API
# ============================================================

APP_NAME = "CalcX Pro"
VERSION = "8.0.0"

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
HISTORY_FILE = DATA_DIR / "history.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="CalcX Pro API",
    version=VERSION,
    description="Production-style safe scientific calculator API",
    docs_url="/docs",
    redoc_url="/redoc",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# REQUEST / RESPONSE MODELS
# ============================================================

AngleMode = Literal["DEG", "RAD", "GRAD"]


class CalculateRequest(BaseModel):
    expression: str = Field(
        ...,
        min_length=1,
        max_length=500,
    )
    angle_mode: AngleMode = "DEG"


class CalculateResponse(BaseModel):
    success: bool
    expression: str
    result: float
    formatted: str
    angle_mode: AngleMode


class HistoryItem(BaseModel):
    expression: str
    result: str
    timestamp: float
    angle_mode: AngleMode


class HistoryResponse(BaseModel):
    success: bool
    items: list[HistoryItem]


# ============================================================
# JSON STORAGE
# ============================================================

def read_history() -> list[dict[str, Any]]:
    try:
        if not HISTORY_FILE.exists():
            return []

        data = json.loads(
            HISTORY_FILE.read_text(
                encoding="utf-8"
            )
        )

        if not isinstance(data, list):
            return []

        return data[:100]

    except Exception:
        return []


def write_history(items: list[dict[str, Any]]) -> None:
    temp_file = HISTORY_FILE.with_suffix(".tmp")

    try:
        temp_file.write_text(
            json.dumps(
                items[:100],
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

        os.replace(
            temp_file,
            HISTORY_FILE,
        )

    except Exception:
        try:
            if temp_file.exists():
                temp_file.unlink()
        except Exception:
            pass


# ============================================================
# FORMATTER
# ============================================================

def format_number(value: float) -> str:
    if not math.isfinite(value):
        raise ValueError("Result is not finite")

    if abs(value) < 1e-14:
        value = 0.0

    if abs(value) >= 1e12:
        return f"{value:.10e}"

    if 0 < abs(value) < 1e-9:
        return f"{value:.10e}"

    text = f"{value:.12f}"

    text = text.rstrip("0").rstrip(".")

    if text in {"", "-0"}:
        return "0"

    return text


# ============================================================
# SAFE SCIENTIFIC ENGINE
# ============================================================

class SafeCalculator:
    FUNCTIONS = {
        "sin",
        "cos",
        "tan",
        "asin",
        "acos",
        "atan",
        "sqrt",
        "log",
        "ln",
        "abs",
        "floor",
        "ceil",
        "exp",
        "factorial",
    }

    CONSTANTS = {
        "pi": math.pi,
        "e": math.e,
        "tau": math.tau,
    }

    OPERATORS = {
        ast.Add: lambda a, b: a + b,
        ast.Sub: lambda a, b: a - b,
        ast.Mult: lambda a, b: a * b,
        ast.Div: lambda a, b: a / b,
        ast.Pow: lambda a, b: a ** b,
        ast.Mod: lambda a, b: a % b,
        ast.USub: lambda a: -a,
        ast.UAdd: lambda a: +a,
    }

    def __init__(self, angle_mode: AngleMode = "DEG"):
        self.angle_mode = angle_mode

    # --------------------------------------------------------
    # ANGLE
    # --------------------------------------------------------

    def to_radians(self, value: float) -> float:
        if self.angle_mode == "DEG":
            return math.radians(value)

        if self.angle_mode == "GRAD":
            return value * math.pi / 200.0

        return value

    def from_radians(self, value: float) -> float:
        if self.angle_mode == "DEG":
            return math.degrees(value)

        if self.angle_mode == "GRAD":
            return value * 200.0 / math.pi

        return value

    # --------------------------------------------------------
    # FACTORIAL
    # --------------------------------------------------------

    def factorial(self, value: float) -> float:
        if value < 0:
            raise ValueError(
                "Factorial requires a non-negative integer"
            )

        if not value.is_integer():
            raise ValueError(
                "Factorial requires an integer"
            )

        if value > 170:
            raise ValueError(
                "Factorial value is too large"
            )

        return float(math.factorial(int(value)))

    # --------------------------------------------------------
    # FUNCTIONS
    # --------------------------------------------------------

    def call_function(
        self,
        name: str,
        args: list[float],
    ) -> float:

        if len(args) != 1:
            raise ValueError(
                f"{name}() requires exactly one argument"
            )

        value = args[0]

        if name in {"sin", "cos", "tan"}:
            return getattr(
                math,
                name,
            )(self.to_radians(value))

        if name in {"asin", "acos", "atan"}:
            result = getattr(
                math,
                name,
            )(value)

            return self.from_radians(result)

        if name == "sqrt":
            if value < 0:
                raise ValueError(
                    "Square root domain error"
                )

            return math.sqrt(value)

        if name == "log":
            if value <= 0:
                raise ValueError(
                    "Logarithm domain error"
                )

            return math.log10(value)

        if name == "ln":
            if value <= 0:
                raise ValueError(
                    "Natural logarithm domain error"
                )

            return math.log(value)

        if name == "abs":
            return abs(value)

        if name == "floor":
            return float(math.floor(value))

        if name == "ceil":
            return float(math.ceil(value))

        if name == "exp":
            return math.exp(value)

        if name == "factorial":
            return self.factorial(value)

        raise ValueError(
            f"Unknown function: {name}"
        )

    # --------------------------------------------------------
    # AST
    # --------------------------------------------------------

    def visit(self, node: ast.AST) -> float:

        if isinstance(node, ast.Expression):
            return self.visit(node.body)

        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                value = float(node.value)

                if not math.isfinite(value):
                    raise ValueError(
                        "Invalid number"
                    )

                return value

            raise ValueError(
                "Invalid constant"
            )

        if isinstance(node, ast.Num):
            return float(node.n)

        if isinstance(node, ast.BinOp):

            operation = type(node.op)

            if operation not in self.OPERATORS:
                raise ValueError(
                    "Unsupported operator"
                )

            left = self.visit(node.left)
            right = self.visit(node.right)

            if operation is ast.Pow:
                if abs(right) > 10000:
                    raise ValueError(
                        "Exponent is too large"
                    )

            result = self.OPERATORS[operation](
                left,
                right,
            )

            if not math.isfinite(result):
                raise ValueError(
                    "Result is not finite"
                )

            return result

        if isinstance(node, ast.UnaryOp):

            operation = type(node.op)

            if operation not in self.OPERATORS:
                raise ValueError(
                    "Unsupported unary operator"
                )

            return self.OPERATORS[operation](
                self.visit(node.operand)
            )

        if isinstance(node, ast.Name):

            if node.id in self.CONSTANTS:
                return self.CONSTANTS[node.id]

            raise ValueError(
                f"Unknown symbol: {node.id}"
            )

        if isinstance(node, ast.Call):

            if not isinstance(
                node.func,
                ast.Name,
            ):
                raise ValueError(
                    "Invalid function"
                )

            name = node.func.id

            if name not in self.FUNCTIONS:
                raise ValueError(
                    f"Unknown function: {name}"
                )

            args = [
                self.visit(argument)
                for argument in node.args
            ]

            return self.call_function(
                name,
                args,
            )

        raise ValueError(
            "Unsupported expression"
        )

    # --------------------------------------------------------
    # NORMALIZER
    # --------------------------------------------------------

    def normalize(
        self,
        expression: str,
    ) -> str:

        expression = expression.strip()

        replacements = {
            "×": "*",
            "÷": "/",
            "−": "-",
            "π": "pi",
            "√": "sqrt",
            "^": "**",
        }

        for old, new in replacements.items():
            expression = expression.replace(
                old,
                new,
            )

        # Percentage
        expression = re.sub(
            r"(\d+(?:\.\d+)?)%",
            r"(\1/100)",
            expression,
        )

        # Number factorial
        expression = re.sub(
            r"(\d+(?:\.\d+)?)!",
            r"factorial(\1)",
            expression,
        )

        # Parenthesized factorial
        expression = re.sub(
            r"(\([^()]+\))!",
            r"factorial(\1)",
            expression,
        )

        # Implicit multiplication:
        # 2pi -> 2*pi
        # 2(3+4) -> 2*(3+4)
        # 2sqrt(9) -> 2*sqrt(9)
        expression = re.sub(
            r"(\d|\))(?=\s*(?:pi|e|sqrt|sin|cos|tan|asin|acos|atan|log|ln|\())",
            r"\1*",
            expression,
        )

        # )(
        expression = re.sub(
            r"\)\s*\(",
            ")*(",
            expression,
        )

        return expression

    # --------------------------------------------------------
    # CALCULATE
    # --------------------------------------------------------

    def calculate(
        self,
        expression: str,
    ) -> float:

        if not expression.strip():
            raise ValueError(
                "Enter an expression"
            )

        if len(expression) > 500:
            raise ValueError(
                "Expression is too long"
            )

        normalized = self.normalize(
            expression
        )

        allowed = re.fullmatch(
            r"[0-9a-zA-Z_+\-*/().%\s]*",
            normalized,
        )

        if not allowed:
            raise ValueError(
                "Invalid characters"
            )

        try:
            tree = ast.parse(
                normalized,
                mode="eval",
            )

        except SyntaxError:
            raise ValueError(
                "Invalid expression"
            )

        result = self.visit(tree)

        if not math.isfinite(result):
            raise ValueError(
                "Result is not finite"
            )

        return float(result)


# ============================================================
# ROUTES
# ============================================================

@app.get("/")
def home():
    return {
        "application": APP_NAME,
        "version": VERSION,
        "status": "online",
        "engine": "safe AST scientific calculator",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "application": APP_NAME,
        "version": VERSION,
    }


@app.post(
    "/api/calculate",
    response_model=CalculateResponse,
)
def calculate(
    request: CalculateRequest,
):

    try:
        engine = SafeCalculator(
            request.angle_mode
        )

        result = engine.calculate(
            request.expression
        )

        formatted = format_number(
            result
        )

        item = {
            "expression": request.expression,
            "result": formatted,
            "timestamp": time.time(),
            "angle_mode": request.angle_mode,
        }

        history = read_history()

        history.insert(
            0,
            item,
        )

        write_history(
            history[:100]
        )

        return CalculateResponse(
            success=True,
            expression=request.expression,
            result=result,
            formatted=formatted,
            angle_mode=request.angle_mode,
        )

    except ZeroDivisionError:
        raise HTTPException(
            status_code=400,
            detail="Cannot divide by zero",
        )

    except OverflowError:
        raise HTTPException(
            status_code=400,
            detail="Calculation overflow",
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Calculation failed",
        )


@app.get(
    "/api/history",
    response_model=HistoryResponse,
)
def get_history():

    items = read_history()

    return HistoryResponse(
        success=True,
        items=[
            HistoryItem(**item)
            for item in items[:100]
        ],
    )


@app.delete(
    "/api/history",
)
def delete_history():

    write_history([])

    return {
        "success": True,
        "message": "History cleared",
    }


# ============================================================
# RUN DIRECTLY
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
    )