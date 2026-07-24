from .models import Artisan, Job


def score_match(job: Job, artisan: Artisan) -> tuple[int, list[str]]:
    score, reasons = 0, []
    if job.trade.lower() in artisan.trade.lower() or artisan.trade.lower() in job.trade.lower():
        score += 45
        reasons.append("Exact trade match")
    if job.area.lower() == artisan.area.lower():
        score += 25
        reasons.append("In the same neighbourhood")
    if artisan.available:
        score += 12
        reasons.append("Available now")
    if artisan.verified:
        score += 10
        reasons.append("Identity and skills verified")
    score += min(8, round(artisan.rating / 5 * 8))
    return min(score, 100), reasons
