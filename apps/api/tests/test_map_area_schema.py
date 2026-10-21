import pytest
from pydantic import ValidationError

from hive.modules.map_areas.schemas import MapAreaCreate


def test_valid_polygon():
    area = MapAreaCreate(name="Desk A", points=[(52, -1), (52.1, -1), (52, -1.1)])
    assert len(area.points) == 3


@pytest.mark.parametrize("points", [
    [(52, -1), (52.1, -1)],
    [(95, -1), (52, -1), (52, -1.1)],
    [(52, -181), (52, -1), (52, -1.1)],
])
def test_invalid_polygon(points):
    with pytest.raises(ValidationError):
        MapAreaCreate(name="Desk A", points=points)


def test_blank_name():
    with pytest.raises(ValidationError):
        MapAreaCreate(name="   ", points=[(52, -1), (52.1, -1), (52, -1.1)])
