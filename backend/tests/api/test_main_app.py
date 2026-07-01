def test_main_app_imports_without_building_real_engine():  # review:PA-T1-AC1
    from weiguan.api.main import app

    assert app.routes
