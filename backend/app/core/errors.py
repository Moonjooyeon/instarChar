class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Authentication required") -> None:
        super().__init__("UNAUTHORIZED", message, 401)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__("FORBIDDEN", message, 403)


class BadRequestError(AppError):
    def __init__(self, message: str = "Bad request") -> None:
        super().__init__("BAD_REQUEST", message, 400)
