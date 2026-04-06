# app/utils/netcdf_parser.py
import xarray as xr

def extract_wave_data_at_coords(file_path: str, target_lat: float, target_lon: float, target_time: str) -> dict:
    """
    Reads a downloaded NetCDF weather file and extracts the exact wave conditions
    for a specific coordinate at a specific time.
    """
    try:
        # Open the multi-dimensional NetCDF dataset
        ds = xr.open_dataset(file_path)

        # .sel() allows us to select data by dimension. 
        # method="nearest" tells it to find the closest grid point if the exact 
        # coordinates don't perfectly align with the weather model's grid.
        nearest_data = ds.sel(
            latitude=target_lat,
            longitude=target_lon,
            time=target_time,
            method="nearest"
        )

        # Extract specific variables. 
        # Note: Variable names vary by provider. 'VHM0' is typically Significant Wave Height in Copernicus.
        wave_height = float(nearest_data.VHM0.values)
        
        # 'VMDR' is typically Mean Wave Direction
        wave_direction = float(nearest_data.VMDR.values)

        # Always close the dataset to free up server memory
        ds.close()

        return {
            "wave_height_m": wave_height,
            "wave_direction_deg": wave_direction
        }
        
    except Exception as e:
        # If the file is corrupt or the coordinates are out of bounds of the file
        raise ValueError(f"Failed to parse NetCDF weather data: {str(e)}")