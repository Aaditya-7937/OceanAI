from pydantic import BaseModel
from typing import List, Any, Optional

class ProjectMeta(BaseModel):
    docType: str
    mainTopic:str
    outline: Optional[List[Any]] = None
    logo_url: Optional[str] = None
    template: Optional[str] = "paradocs-default"
