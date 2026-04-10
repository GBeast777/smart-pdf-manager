import re

def assign_category(text: str) -> str:
    """
    NLP/Keyword extraction to auto-categorize the document.
    Categorizes based on the highest frequency of category-specific keywords using word boundaries.
    """
    text_lower = text.lower()
    
    categories = {
        "Finance": [r"\binvoice\b", r"\breceipt\b", r"\btax\b", r"\bpayment\b", r"\bbank\b", r"\bfinancial\b", r"\bbill\b", r"\bsalary\b", r"\bstatement\b", r"\bexpense\b"],
        "Healthcare": [r"\bmedical\b", r"\bhealth\b", r"\bpatient\b", r"\bdoctor\b", r"\bhospital\b", r"\bprescription\b", r"\bclinic\b", r"\bdiagnosis\b"],
        "Legal": [r"\bcontract\b", r"\bagreement\b", r"\blaw\b", r"\bcourt\b", r"\blegal\b", r"\bterms\b", r"\bpolicy\b", r"\bnda\b", r"\bsignature\b"],
        "Technology": [r"\bsoftware\b", r"\bhardware\b", r"\bcode\b", r"\btech\b", r"\bcomputer\b", r"\bsystem\b", r"\bdata\b", r"\bit\b", r"\bserver\b", r"\bnetwork\b"],
        "Education": [r"\bassignment\b", r"\bcourse\b", r"\bgrade\b", r"\buniversity\b", r"\bstudent\b", r"\bclass\b", r"\bsyllabus\b", r"\bexam\b", r"\blecture\b"]
    }
    
    scores = {cat: 0 for cat in categories}
    for cat, keywords in categories.items():
        for kw in keywords:
            # count occurrences using regex
            matches = re.findall(kw, text_lower)
            scores[cat] += len(matches)
            
    max_cat = max(scores, key=scores.get)
    if scores[max_cat] > 0:
        return max_cat
        
    return "Others"

