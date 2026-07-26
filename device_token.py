from sqlalchemy import text

from hive.core.security import create_access_token
from hive.db.session import SessionLocal

db = SessionLocal()

device = db.execute(
    text("""
        SELECT id, organization_id, device_token_version
        FROM devices
        WHERE hive_id = 'HB-EF0085'
        LIMIT 1
    """)
).mappings().first()

if device is None:
    raise Exception("Device not found")

token, expires_in = create_access_token(
    subject=str(device["id"]),
    additional_claims={
        "type": "device",
        "organization_id": str(device["organization_id"]),
        "token_version": device["device_token_version"],
    },
)

print("\nDEVICE TOKEN:\n")
print(token)
print("\nEXPIRES IN:", expires_in)

db.close()